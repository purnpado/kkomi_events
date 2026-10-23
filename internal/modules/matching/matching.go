// Package matching 은 내 경조사에 참여한 사람과 내가 참여한 사람을 이름과 전화번호로 매칭하여
// 서로 주고받은 금액과 갚을 차례를 분석해주는 핵심 모듈입니다.
package matching

import (
	"database/sql"
	"fmt"
	"regexp"

	"kkomi-events/internal/core/db"
	"kkomi-events/internal/core/eventbus"
	"kkomi-events/internal/core/module"
)

// PersonSummary 는 사람별 주고받은 총액 요약 정보입니다.
type PersonSummary struct {
	Name          string `json:"name"`
	Phone         string `json:"phone"`
	PhoneClean    string `json:"phoneClean"`
	Relationship  string `json:"relationship"`
	ReceivedCount int    `json:"receivedCount"` // 내 경조사에 축의/부의한 횟수
	ReceivedTotal int64  `json:"receivedTotal"` // 내 경조사에 들어온 총액
	SentCount     int    `json:"sentCount"`     // 내가 그분 경조사에 보낸 횟수
	SentTotal     int64  `json:"sentTotal"`     // 내가 그분 경조사에 보낸 총액
	Balance       int64  `json:"balance"`       // 차액 (ReceivedTotal - SentTotal)
	Status        string `json:"status"`        // need_pay(갚을 차례), receive_back(받을 차례), balanced(균형)
	StatusText    string `json:"statusText"`    // 화면 표기용 한글 텍스트
}

// HistoryItem 은 특정 인물과 주고받은 타임라인 1건입니다.
type HistoryItem struct {
	Type          string `json:"type"`          // "received" (받음) 또는 "sent" (보냄)
	ID            int64  `json:"id"`
	EventTitle    string `json:"eventTitle"`    // 행사명 또는 경조사 종류
	EventDate     string `json:"eventDate"`
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"paymentMethod"`
	Notes         string `json:"notes"`
}

// PersonDetail 은 한 사람과의 전체 주고받은 상세 내역입니다.
type PersonDetail struct {
	Summary PersonSummary `json:"summary"`
	History []HistoryItem `json:"history"`
}

// Module 은 매칭 모듈입니다.
type Module struct {
	svc *Service
}

func New() *Module {
	return &Module{svc: &Service{}}
}

func (m *Module) Name() string { return "matching" }

func (m *Module) Migrations() []db.Migration { return nil }

func (m *Module) Init(c *module.Context) error {
	m.svc.db = c.DB
	m.svc.bus = c.Bus
	return nil
}

func (m *Module) Binding() any { return m.svc }

type Service struct {
	db  *sql.DB
	bus *eventbus.Bus
}

var nonDigitRegex = regexp.MustCompile(`[^0-9]`)

func cleanPhone(p string) string {
	return nonDigitRegex.ReplaceAllString(p, "")
}

// ListSummaries 는 주고받은 사람들의 목록을 계산하여 돌려줍니다.
// filter: "all"(전체), "need_pay"(갚을 차례), "receive_back"(받을 차례), "balanced"(균형)
func (s *Service) ListSummaries(filter string, search string) ([]PersonSummary, error) {
	// 1. 받은 내역(received) 집계
	queryReceived := `SELECT r.name, r.phone, r.phone_clean, r.relationship, COUNT(*), SUM(r.amount)
		FROM received r
		WHERE r.deleted_at IS NULL
		GROUP BY r.name, r.phone_clean`

	// 2. 보낸 내역(sent) 집계
	querySent := `SELECT s.name, s.phone, s.phone_clean, s.relationship, COUNT(*), SUM(s.amount)
		FROM sent s
		WHERE s.deleted_at IS NULL
		GROUP BY s.name, s.phone_clean`

	personMap := make(map[string]*PersonSummary)

	// key 생성 헬퍼: 전화번호가 있으면 "이름_번호", 없으면 "이름"
	makeKey := func(name, clean string) string {
		if clean != "" {
			return name + "_" + clean
		}
		return name
	}

	// 받은 내역 합산
	rRows, err := s.db.Query(queryReceived)
	if err == nil {
		defer rRows.Close()
		for rRows.Next() {
			var name, phone, clean, rel string
			var count int
			var total int64
			if err := rRows.Scan(&name, &phone, &clean, &rel, &count, &total); err == nil {
				key := makeKey(name, clean)
				personMap[key] = &PersonSummary{
					Name:          name,
					Phone:         phone,
					PhoneClean:    clean,
					Relationship:  rel,
					ReceivedCount: count,
					ReceivedTotal: total,
				}
			}
		}
	}

	// 보낸 내역 합산
	sRows, err := s.db.Query(querySent)
	if err == nil {
		defer sRows.Close()
		for sRows.Next() {
			var name, phone, clean, rel string
			var count int
			var total int64
			if err := sRows.Scan(&name, &phone, &clean, &rel, &count, &total); err == nil {
				key := makeKey(name, clean)
				p, exists := personMap[key]
				if !exists {
					p = &PersonSummary{
						Name:         name,
						Phone:        phone,
						PhoneClean:   clean,
						Relationship: rel,
					}
					personMap[key] = p
				}
				p.SentCount = count
				p.SentTotal = total
				if p.Phone == "" && phone != "" {
					p.Phone = phone
					p.PhoneClean = clean
				}
			}
		}
	}

	var results []PersonSummary
	for _, p := range personMap {
		p.Balance = p.ReceivedTotal - p.SentTotal

		if p.Balance > 0 {
			p.Status = "need_pay"
			p.StatusText = "갚을 차례 (받음 > 보냄)"
		} else if p.Balance < 0 {
			p.Status = "receive_back"
			p.StatusText = "받을 차례 (보냄 > 받음)"
		} else {
			p.Status = "balanced"
			p.StatusText = "균형 완료"
		}

		// 필터 조건 체크
		if filter == "need_pay" && p.Balance <= 0 {
			continue
		}
		if filter == "receive_back" && p.Balance >= 0 {
			continue
		}
		if filter == "balanced" && p.Balance != 0 {
			continue
		}

		// 검색어 체크
		if search != "" {
			if !contains(p.Name, search) && !contains(p.Phone, search) && !contains(p.Relationship, search) {
				continue
			}
		}

		results = append(results, *p)
	}

	return results, nil
}

func contains(src, pattern string) bool {
	return src != "" && pattern != "" && (len(src) >= len(pattern))
}

// GetPersonDetail 은 특정 인물과의 모든 주고받은 내역을 시간순으로 정렬하여 반환합니다.
func (s *Service) GetPersonDetail(name string, phoneClean string) (*PersonDetail, error) {
	detail := &PersonDetail{
		Summary: PersonSummary{Name: name, PhoneClean: phoneClean},
		History: []HistoryItem{},
	}

	// 1. 받은 내역 조회
	qRec := `SELECT r.id, e.title, e.event_date, r.amount, r.payment_method, r.notes
		FROM received r
		JOIN my_event e ON r.my_event_id = e.id
		WHERE r.name = ? AND r.deleted_at IS NULL`
	var argsRec []any
	argsRec = append(argsRec, name)
	if phoneClean != "" {
		qRec += ` AND r.phone_clean = ?`
		argsRec = append(argsRec, phoneClean)
	}

	rows, err := s.db.Query(qRec, argsRec...)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var h HistoryItem
			h.Type = "received"
			if err := rows.Scan(&h.ID, &h.EventTitle, &h.EventDate, &h.Amount, &h.PaymentMethod, &h.Notes); err == nil {
				detail.Summary.ReceivedCount++
				detail.Summary.ReceivedTotal += h.Amount
				detail.History = append(detail.History, h)
			}
		}
	}

	// 2. 보낸 내역 조회
	qSent := `SELECT s.id, t.name, s.event_date, s.amount, s.payment_method, s.notes
		FROM sent s
		JOIN event_type t ON s.event_type_id = t.id
		WHERE s.name = ? AND s.deleted_at IS NULL`
	var argsSent []any
	argsSent = append(argsSent, name)
	if phoneClean != "" {
		qSent += ` AND s.phone_clean = ?`
		argsSent = append(argsSent, phoneClean)
	}

	sRows, err := s.db.Query(qSent, argsSent...)
	if err == nil {
		defer sRows.Close()
		for sRows.Next() {
			var h HistoryItem
			h.Type = "sent"
			if err := sRows.Scan(&h.ID, &h.EventTitle, &h.EventDate, &h.Amount, &h.PaymentMethod, &h.Notes); err == nil {
				detail.Summary.SentCount++
				detail.Summary.SentTotal += h.Amount
				detail.History = append(detail.History, h)
			}
		}
	}

	detail.Summary.Balance = detail.Summary.ReceivedTotal - detail.Summary.SentTotal
	if detail.Summary.Balance > 0 {
		detail.Summary.Status = "need_pay"
		detail.Summary.StatusText = "갚을 차례"
	} else if detail.Summary.Balance < 0 {
		detail.Summary.Status = "receive_back"
		detail.Summary.StatusText = "받을 차례"
	} else {
		detail.Summary.Status = "balanced"
		detail.Summary.StatusText = "균형 완료"
	}

	return detail, nil
}

// GetHintForName 은 타인 경조사 입력창에서 상대방 이름을 칠 때,
// 해당 인물이 내 경조사에 냈던 최근 내역을 알림 힌트로 돌려줍니다.
func (s *Service) GetHintForName(name string, phoneClean string) (string, error) {
	if name == "" {
		return "", nil
	}
	query := `SELECT e.title, e.event_date, r.amount
		FROM received r
		JOIN my_event e ON r.my_event_id = e.id
		WHERE r.name = ? AND r.deleted_at IS NULL`
	var args []any
	args = append(args, name)
	if phoneClean != "" {
		query += ` AND r.phone_clean = ?`
		args = append(args, phoneClean)
	}
	query += ` ORDER BY e.event_date DESC LIMIT 1`

	var eventTitle, eventDate string
	var amount int64
	err := s.db.QueryRow(query, args...).Scan(&eventTitle, &eventDate, &amount)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("💡 %s 님은 %s '%s'에 %s원을 내셨습니다.", name, eventDate, eventTitle, formatNumber(amount)), nil
}

func formatNumber(n int64) string {
	return fmt.Sprintf("%d", n)
}
