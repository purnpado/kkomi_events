// Package sent 는 타인의 경조사(지출/보낸 돈)를 관리하는 모듈입니다.
package sent

import (
	"database/sql"
	"fmt"
	"regexp"
	"time"

	"kkomi-events/internal/core/db"
	"kkomi-events/internal/core/eventbus"
	"kkomi-events/internal/core/module"
)

// 이벤트 이름 상수
const (
	EventCreated = "sent.created"
	EventUpdated = "sent.updated"
	EventDeleted = "sent.deleted"
)

// SentItem 은 타인의 경조사에 지출한 내역 1건입니다.
type SentItem struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	Phone         string `json:"phone"`
	PhoneClean    string `json:"phoneClean"`
	Relationship  string `json:"relationship"`
	EventTypeID   int64  `json:"eventTypeId"`
	EventTypeName string `json:"eventTypeName,omitempty"`
	EventTypeIcon string `json:"eventTypeIcon,omitempty"`
	EventDate     string `json:"eventDate"`
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"paymentMethod"`
	Attended      bool   `json:"attended"`
	MemberSide    string `json:"memberSide"`
	Notes         string `json:"notes"`
	CreatedAt     string `json:"createdAt"`
	UpdatedAt     string `json:"updatedAt"`
}

// Module 은 타인 경조사 지출 모듈입니다.
type Module struct {
	svc *Service
}

func New() *Module {
	return &Module{svc: &Service{}}
}

func (m *Module) Name() string { return "sent" }

func (m *Module) Migrations() []db.Migration {
	return []db.Migration{
		{
			Version: 1,
			Name:    "타인 경조사(지출) 테이블 생성",
			SQL: `CREATE TABLE IF NOT EXISTS sent (
				id              INTEGER PRIMARY KEY AUTOINCREMENT,
				name            TEXT NOT NULL,
				phone           TEXT NOT NULL DEFAULT '',
				phone_clean     TEXT NOT NULL DEFAULT '',
				relationship    TEXT NOT NULL DEFAULT '지인',
				event_type_id   INTEGER NOT NULL,
				event_date      TEXT NOT NULL,
				amount          INTEGER NOT NULL DEFAULT 0,
				payment_method  TEXT NOT NULL DEFAULT '계좌이체',
				attended        INTEGER NOT NULL DEFAULT 1,
				member_side     TEXT NOT NULL DEFAULT '',
				notes           TEXT NOT NULL DEFAULT '',
				created_at      TEXT NOT NULL,
				updated_at      TEXT NOT NULL,
				deleted_at      TEXT,
				FOREIGN KEY(event_type_id) REFERENCES event_type(id)
			);

			CREATE INDEX IF NOT EXISTS idx_sent_name ON sent(name);
			CREATE INDEX IF NOT EXISTS idx_sent_phone ON sent(phone_clean);
			CREATE INDEX IF NOT EXISTS idx_sent_date ON sent(event_date);`,
		},
	}
}

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

// List 는 타인 경조사 지출 목록을 검색 및 종류 필터와 함께 조회합니다.
func (s *Service) List(eventTypeId int64, search string) ([]SentItem, error) {
	query := `SELECT s.id, s.name, s.phone, s.phone_clean, s.relationship, s.event_type_id,
		t.name, t.icon, s.event_date, s.amount, s.payment_method, s.attended, s.member_side, s.notes,
		s.created_at, s.updated_at
		FROM sent s
		JOIN event_type t ON s.event_type_id = t.id
		WHERE s.deleted_at IS NULL`
	var args []any

	if eventTypeId > 0 {
		query += ` AND s.event_type_id = ?`
		args = append(args, eventTypeId)
	}

	if search != "" {
		query += ` AND (s.name LIKE ? OR s.phone LIKE ? OR s.relationship LIKE ? OR s.notes LIKE ?)`
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern, pattern, pattern)
	}

	query += ` ORDER BY s.event_date DESC, s.id DESC`

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []SentItem
	for rows.Next() {
		var item SentItem
		var attendedInt int
		if err := rows.Scan(&item.ID, &item.Name, &item.Phone, &item.PhoneClean, &item.Relationship,
			&item.EventTypeID, &item.EventTypeName, &item.EventTypeIcon, &item.EventDate,
			&item.Amount, &item.PaymentMethod, &attendedInt, &item.MemberSide, &item.Notes,
			&item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		item.Attended = (attendedInt == 1)
		list = append(list, item)
	}
	return list, rows.Err()
}

// Create 는 새 타인 경조사 보낸 내역 1건을 저장합니다.
func (s *Service) Create(name, phone, relationship string, eventTypeId int64, eventDate string, amount int64, paymentMethod string, attended bool, memberSide, notes string) (*SentItem, error) {
	if name == "" {
		return nil, fmt.Errorf("상대방 이름을 입력해주세요.")
	}
	if eventDate == "" {
		eventDate = time.Now().Format("2006-01-02")
	}
	if relationship == "" {
		relationship = "지인"
	}
	if paymentMethod == "" {
		paymentMethod = "계좌이체"
	}
	now := time.Now().Format(time.RFC3339)
	clean := cleanPhone(phone)
	attendedInt := 0
	if attended {
		attendedInt = 1
	}

	res, err := s.db.Exec(`INSERT INTO sent(name, phone, phone_clean, relationship, event_type_id, event_date, amount, payment_method, attended, member_side, notes, created_at, updated_at)
		VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		name, phone, clean, relationship, eventTypeId, eventDate, amount, paymentMethod, attendedInt, memberSide, notes, now, now)
	if err != nil {
		return nil, fmt.Errorf("보낸 내역 추가 실패: %w", err)
	}
	id, _ := res.LastInsertId()
	item := &SentItem{
		ID:            id,
		Name:          name,
		Phone:         phone,
		PhoneClean:    clean,
		Relationship:  relationship,
		EventTypeID:   eventTypeId,
		EventDate:     eventDate,
		Amount:        amount,
		PaymentMethod: paymentMethod,
		Attended:      attended,
		MemberSide:    memberSide,
		Notes:         notes,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	s.bus.Publish("sent", EventCreated, item)
	return item, nil
}

// Update 는 타인 경조사 내역을 수정합니다.
func (s *Service) Update(id int64, name, phone, relationship string, eventTypeId int64, eventDate string, amount int64, paymentMethod string, attended bool, memberSide, notes string) error {
	now := time.Now().Format(time.RFC3339)
	clean := cleanPhone(phone)
	attendedInt := 0
	if attended {
		attendedInt = 1
	}

	_, err := s.db.Exec(`UPDATE sent SET name=?, phone=?, phone_clean=?, relationship=?, event_type_id=?, event_date=?, amount=?, payment_method=?, attended=?, member_side=?, notes=?, updated_at=?
		WHERE id=?`, name, phone, clean, relationship, eventTypeId, eventDate, amount, paymentMethod, attendedInt, memberSide, notes, now, id)
	if err != nil {
		return fmt.Errorf("보낸 내역 수정 실패: %w", err)
	}
	s.bus.Publish("sent", EventUpdated, map[string]any{"id": id, "name": name, "phone": phone, "amount": amount})
	return nil
}

// Delete 는 보낸 내역 1건을 휴지통으로 보냅니다.
func (s *Service) Delete(id int64) error {
	now := time.Now().Format(time.RFC3339)
	_, err := s.db.Exec(`UPDATE sent SET deleted_at=? WHERE id=?`, now, id)
	if err != nil {
		return fmt.Errorf("보낸 내역 삭제 실패: %w", err)
	}
	s.bus.Publish("sent", EventDeleted, map[string]any{"id": id})
	return nil
}
