// Package matching 은 내 경조사에 참여한 사람과 내가 참여한 사람을 이름과 전화번호로 매칭하여
// 서로 주고받은 금액과 갚을 차례를 분석해주는 핵심 모듈입니다.
package matching

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

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

	// 내 경조사 또는 타인 경조사에 전화번호가 등록/수정되면 동일 인물의 비어있는 전화번호를 상호 자동 동기화
	c.Bus.Subscribe("sent.created", func(e eventbus.Event) {
		m.svc.handleAutoSync(e.Payload)
	})
	c.Bus.Subscribe("sent.updated", func(e eventbus.Event) {
		m.svc.handleAutoSync(e.Payload)
	})
	c.Bus.Subscribe("myevent.received_created", func(e eventbus.Event) {
		m.svc.handleAutoSync(e.Payload)
	})
	c.Bus.Subscribe("myevent.received_updated", func(e eventbus.Event) {
		m.svc.handleAutoSync(e.Payload)
	})

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
	queryReceived := `SELECT TRIM(r.name), r.phone, r.phone_clean, r.relationship, COUNT(*), SUM(r.amount)
		FROM received r
		WHERE r.deleted_at IS NULL
		GROUP BY TRIM(r.name), r.phone_clean`

	// 2. 보낸 내역(sent) 집계
	querySent := `SELECT TRIM(s.name), s.phone, s.phone_clean, s.relationship, COUNT(*), SUM(s.amount)
		FROM sent s
		WHERE s.deleted_at IS NULL
		GROUP BY TRIM(s.name), s.phone_clean`

	var list []*PersonSummary

	// 지능적 인물 매칭 헬퍼:
	// 동일 이름이 이미 있고, 둘 중 한쪽의 전화번호가 비어있거나 번호가 동일하면 같은 사람으로 합침
	findOrCreatePerson := func(name, phone, clean, rel string) *PersonSummary {
		name = strings.TrimSpace(name)
		clean = cleanPhone(clean)

		for _, p := range list {
			if strings.EqualFold(p.Name, name) {
				// 1) 둘 다 번호가 있고 번호가 일치하는 경우 -> 동일인
				if p.PhoneClean != "" && clean != "" && p.PhoneClean == clean {
					if p.Relationship == "" && rel != "" {
						p.Relationship = rel
					}
					return p
				}
				// 2) 한쪽이라도 번호가 비어있는 경우 -> 동일인으로 지능적 병합
				if p.PhoneClean == "" || clean == "" {
					if p.Phone == "" && phone != "" {
						p.Phone = phone
						p.PhoneClean = clean
					}
					if p.Relationship == "" && rel != "" {
						p.Relationship = rel
					}
					return p
				}
			}
		}

		// 새 인물 생성
		newP := &PersonSummary{
			Name:         name,
			Phone:        phone,
			PhoneClean:   clean,
			Relationship: rel,
		}
		list = append(list, newP)
		return newP
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
				p := findOrCreatePerson(name, phone, clean, rel)
				p.ReceivedCount += count
				p.ReceivedTotal += total
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
				p := findOrCreatePerson(name, phone, clean, rel)
				p.SentCount += count
				p.SentTotal += total
				if p.Phone == "" && phone != "" {
					p.Phone = phone
					p.PhoneClean = clean
				}
			}
		}
	}

	var results []PersonSummary
	searchLower := strings.ToLower(strings.TrimSpace(search))

	for _, p := range list {
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
		if searchLower != "" {
			nameMatch := strings.Contains(strings.ToLower(p.Name), searchLower)
			phoneMatch := strings.Contains(strings.ToLower(p.Phone), searchLower) || strings.Contains(p.PhoneClean, searchLower)
			relMatch := strings.Contains(strings.ToLower(p.Relationship), searchLower)
			if !nameMatch && !phoneMatch && !relMatch {
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
	name = strings.TrimSpace(name)
	phoneClean = cleanPhone(phoneClean)

	detail := &PersonDetail{
		Summary: PersonSummary{Name: name, PhoneClean: phoneClean},
		History: []HistoryItem{},
	}

	// 1. 받은 내역 조회
	qRec := `SELECT r.id, e.title, e.event_date, r.amount, r.payment_method, r.notes
		FROM received r
		JOIN my_event e ON r.my_event_id = e.id
		WHERE TRIM(r.name) = ? AND r.deleted_at IS NULL`
	var argsRec []any
	argsRec = append(argsRec, name)
	if phoneClean != "" {
		qRec += ` AND (r.phone_clean = ? OR r.phone_clean = '' OR r.phone_clean IS NULL)`
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
		WHERE TRIM(s.name) = ? AND s.deleted_at IS NULL`
	var argsSent []any
	argsSent = append(argsSent, name)
	if phoneClean != "" {
		qSent += ` AND (s.phone_clean = ? OR s.phone_clean = '' OR s.phone_clean IS NULL)`
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

	// 주고받은 타임라인을 행사일자 최신순(EventDate DESC, ID DESC)으로 정렬
	sort.Slice(detail.History, func(i, j int) bool {
		if detail.History[i].EventDate != detail.History[j].EventDate {
			return detail.History[i].EventDate > detail.History[j].EventDate
		}
		return detail.History[i].ID > detail.History[j].ID
	})

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

// FindPhoneByName 은 특정 지인 이름으로 등록된 기존 전화번호가 있는지
// 나의 경조사(received) 및 타인의 경조사(sent) 전체에서 가장 최신 번호 1건을 찾아 돌려줍니다.
func (s *Service) FindPhoneByName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", nil
	}
	var phone string
	err := s.db.QueryRow(`
		SELECT phone FROM (
			SELECT phone, updated_at FROM received WHERE name = ? AND phone != '' AND phone IS NOT NULL AND deleted_at IS NULL
			UNION ALL
			SELECT phone, updated_at FROM sent WHERE name = ? AND phone != '' AND phone IS NOT NULL AND deleted_at IS NULL
		) ORDER BY updated_at DESC LIMIT 1`, name, name).Scan(&phone)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return phone, nil
}

// SyncPhoneForName 은 동일한 이름을 가진 모든 내역 중 전화번호가 비어있는 행들에
// 전달받은 전화번호를 일괄 동기화하여 채워줍니다.
func (s *Service) SyncPhoneForName(name string, phone string) (int, error) {
	name = strings.TrimSpace(name)
	phone = strings.TrimSpace(phone)
	if name == "" || phone == "" {
		return 0, nil
	}
	clean := cleanPhone(phone)
	if clean == "" {
		return 0, nil
	}
	now := time.Now().Format(time.RFC3339)

	res1, err := s.db.Exec(`UPDATE received SET phone = ?, phone_clean = ?, updated_at = ?
		WHERE name = ? AND (phone IS NULL OR phone = '') AND deleted_at IS NULL`, phone, clean, now, name)
	if err != nil {
		return 0, err
	}
	rows1, _ := res1.RowsAffected()

	res2, err := s.db.Exec(`UPDATE sent SET phone = ?, phone_clean = ?, updated_at = ?
		WHERE name = ? AND (phone IS NULL OR phone = '') AND deleted_at IS NULL`, phone, clean, now, name)
	if err != nil {
		return 0, err
	}
	rows2, _ := res2.RowsAffected()

	total := int(rows1 + rows2)
	if total > 0 && s.bus != nil {
		s.bus.Publish("matching", "matching.phone_synced", map[string]any{
			"name":        name,
			"phone":       phone,
			"syncedCount": total,
		})
	}
	return total, nil
}

func (s *Service) handleAutoSync(payload any) {
	if payload == nil {
		return
	}
	var target struct {
		Name  string `json:"name"`
		Phone string `json:"phone"`
	}

	// JSON 직렬화 후 역직렬화하여 map/struct 모두 일관되게 추출
	bytes, err := json.Marshal(payload)
	if err == nil {
		if err := json.Unmarshal(bytes, &target); err == nil {
			if target.Name != "" && target.Phone != "" {
				_, _ = s.SyncPhoneForName(target.Name, target.Phone)
			}
		}
	}
}

func formatNumber(n int64) string {
	return fmt.Sprintf("%d", n)
}
