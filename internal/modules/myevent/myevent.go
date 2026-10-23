// Package myevent 는 나의 경조사(행사)와 받은 내역을 관리하는 모듈입니다.
package myevent

import (
	"database/sql"
	"fmt"
	"regexp"
	"time"

	"kkomi-events/internal/core/db"
	"kkomi-events/internal/core/eventbus"
	"kkomi-events/internal/core/module"
)

// 이벤트 이름
const (
	EventMyEventCreated = "myevent.created"
	EventMyEventUpdated = "myevent.updated"
	EventMyEventDeleted = "myevent.deleted"

	EventReceivedCreated = "received.created"
	EventReceivedUpdated = "received.updated"
	EventReceivedDeleted = "received.deleted"
)

// MyEvent 는 나의 경조사 행사 구조체입니다.
type MyEvent struct {
	ID            int64  `json:"id"`
	EventTypeID   int64  `json:"eventTypeId"`
	EventTypeName string `json:"eventTypeName,omitempty"`
	EventTypeIcon string `json:"eventTypeIcon,omitempty"`
	Title         string `json:"title"`
	EventDate     string `json:"eventDate"`
	Location      string `json:"location"`
	TargetName    string `json:"targetName"`
	MemberSide    string `json:"memberSide"`
	Notes         string `json:"notes"`
	TotalCount    int    `json:"totalCount,omitempty"`
	TotalAmount   int64  `json:"totalAmount,omitempty"`
	CreatedAt     string `json:"createdAt"`
	UpdatedAt     string `json:"updatedAt"`
}

// ReceivedItem 은 특정 행사에 들어온 경조사비 받은 내역 1건입니다.
type ReceivedItem struct {
	ID            int64  `json:"id"`
	MyEventID     int64  `json:"myEventId"`
	MyEventTitle  string `json:"myEventTitle,omitempty"`
	Name          string `json:"name"`
	Phone         string `json:"phone"`
	PhoneClean    string `json:"phoneClean"`
	Relationship  string `json:"relationship"`
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"paymentMethod"`
	Attendance    string `json:"attendance"`
	IsThanked     bool   `json:"isThanked"`
	MemberSide    string `json:"memberSide"`
	Notes         string `json:"notes"`
	CreatedAt     string `json:"createdAt"`
	UpdatedAt     string `json:"updatedAt"`
}

// Module 은 나의 경조사 모듈입니다.
type Module struct {
	svc *Service
}

func New() *Module {
	return &Module{svc: &Service{}}
}

func (m *Module) Name() string { return "myevent" }

func (m *Module) Migrations() []db.Migration {
	return []db.Migration{
		{
			Version: 1,
			Name:    "나의 경조사 및 받은 내역 테이블 생성",
			SQL: `CREATE TABLE IF NOT EXISTS my_event (
				id             INTEGER PRIMARY KEY AUTOINCREMENT,
				event_type_id  INTEGER NOT NULL,
				title          TEXT NOT NULL,
				event_date     TEXT NOT NULL,
				location       TEXT NOT NULL DEFAULT '',
				target_name    TEXT NOT NULL DEFAULT '',
				member_side    TEXT NOT NULL DEFAULT '',
				notes          TEXT NOT NULL DEFAULT '',
				created_at     TEXT NOT NULL,
				updated_at     TEXT NOT NULL,
				deleted_at     TEXT,
				FOREIGN KEY(event_type_id) REFERENCES event_type(id)
			);

			CREATE TABLE IF NOT EXISTS received (
				id              INTEGER PRIMARY KEY AUTOINCREMENT,
				my_event_id     INTEGER NOT NULL,
				name            TEXT NOT NULL,
				phone           TEXT NOT NULL DEFAULT '',
				phone_clean     TEXT NOT NULL DEFAULT '',
				relationship    TEXT NOT NULL DEFAULT '지인',
				amount          INTEGER NOT NULL DEFAULT 0,
				payment_method  TEXT NOT NULL DEFAULT '현금',
				is_thanked      INTEGER NOT NULL DEFAULT 0,
				member_side     TEXT NOT NULL DEFAULT '',
				notes           TEXT NOT NULL DEFAULT '',
				created_at      TEXT NOT NULL,
				updated_at      TEXT NOT NULL,
				deleted_at      TEXT,
				FOREIGN KEY(my_event_id) REFERENCES my_event(id)
			);

			CREATE INDEX IF NOT EXISTS idx_received_myevent ON received(my_event_id);
			CREATE INDEX IF NOT EXISTS idx_received_name ON received(name);
			CREATE INDEX IF NOT EXISTS idx_received_phone ON received(phone_clean);`,
		},
		{
			Version: 2,
			Name:    "참석 여부(직접참석/불참지인전달/불참송금 등) 컬럼 추가",
			SQL:     `ALTER TABLE received ADD COLUMN attendance TEXT NOT NULL DEFAULT '직접 참석';`,
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

// ── 나의 경조사 행사(MyEvent) CRUD ──

// ListEvents 는 특정 종류(탭)에 속하거나 전체 나의 경조사 행사 목록을 가져옵니다.
func (s *Service) ListEvents(eventTypeId int64) ([]MyEvent, error) {
	query := `SELECT e.id, e.event_type_id, t.name, t.icon, e.title, e.event_date, e.location, e.target_name,
		e.member_side, e.notes, e.created_at, e.updated_at,
		COALESCE((SELECT COUNT(*) FROM received r WHERE r.my_event_id=e.id AND r.deleted_at IS NULL), 0) as total_count,
		COALESCE((SELECT SUM(amount) FROM received r WHERE r.my_event_id=e.id AND r.deleted_at IS NULL), 0) as total_amount
		FROM my_event e
		JOIN event_type t ON e.event_type_id = t.id
		WHERE e.deleted_at IS NULL`
	var args []any
	if eventTypeId > 0 {
		query += ` AND e.event_type_id = ?`
		args = append(args, eventTypeId)
	}
	query += ` ORDER BY e.event_date DESC, e.id DESC`

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []MyEvent
	for rows.Next() {
		var ev MyEvent
		if err := rows.Scan(&ev.ID, &ev.EventTypeID, &ev.EventTypeName, &ev.EventTypeIcon,
			&ev.Title, &ev.EventDate, &ev.Location, &ev.TargetName, &ev.MemberSide, &ev.Notes,
			&ev.CreatedAt, &ev.UpdatedAt, &ev.TotalCount, &ev.TotalAmount); err != nil {
			return nil, err
		}
		list = append(list, ev)
	}
	return list, rows.Err()
}

// CreateEvent 는 새 행사를 추가합니다.
func (s *Service) CreateEvent(eventTypeId int64, title, eventDate, location, targetName, memberSide, notes string) (*MyEvent, error) {
	if title == "" {
		return nil, fmt.Errorf("행사 제목을 입력해주세요.")
	}
	if eventDate == "" {
		eventDate = time.Now().Format("2006-01-02")
	}
	now := time.Now().Format(time.RFC3339)
	res, err := s.db.Exec(`INSERT INTO my_event(event_type_id, title, event_date, location, target_name, member_side, notes, created_at, updated_at)
		VALUES(?,?,?,?,?,?,?,?,?)`, eventTypeId, title, eventDate, location, targetName, memberSide, notes, now, now)
	if err != nil {
		return nil, fmt.Errorf("행사 추가 실패: %w", err)
	}
	id, _ := res.LastInsertId()
	ev := &MyEvent{
		ID:          id,
		EventTypeID: eventTypeId,
		Title:       title,
		EventDate:   eventDate,
		Location:    location,
		TargetName:  targetName,
		MemberSide:  memberSide,
		Notes:       notes,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	s.bus.Publish("myevent", EventMyEventCreated, ev)
	return ev, nil
}

// UpdateEvent 는 행사 정보를 수정합니다.
func (s *Service) UpdateEvent(id int64, eventTypeId int64, title, eventDate, location, targetName, memberSide, notes string) error {
	now := time.Now().Format(time.RFC3339)
	_, err := s.db.Exec(`UPDATE my_event SET event_type_id=?, title=?, event_date=?, location=?, target_name=?, member_side=?, notes=?, updated_at=?
		WHERE id=?`, eventTypeId, title, eventDate, location, targetName, memberSide, notes, now, id)
	if err != nil {
		return fmt.Errorf("행사 수정 실패: %w", err)
	}
	s.bus.Publish("myevent", EventMyEventUpdated, map[string]any{"id": id, "title": title})
	return nil
}

// DeleteEvent 는 행사를 휴지통으로 이동시킵니다.
func (s *Service) DeleteEvent(id int64) error {
	now := time.Now().Format(time.RFC3339)
	_, err := s.db.Exec(`UPDATE my_event SET deleted_at=? WHERE id=?`, now, id)
	if err != nil {
		return fmt.Errorf("행사 삭제 실패: %w", err)
	}
	// 연결된 내역도 휴지통으로 함께 처리
	_, _ = s.db.Exec(`UPDATE received SET deleted_at=? WHERE my_event_id=? AND deleted_at IS NULL`, now, id)
	s.bus.Publish("myevent", EventMyEventDeleted, map[string]any{"id": id})
	return nil
}

// ── 받은 내역(ReceivedItem) CRUD ──

// ListReceived 는 특정 행사의 받은 내역을 검색어와 함께 가져옵니다.
func (s *Service) ListReceived(myEventId int64, search string) ([]ReceivedItem, error) {
	query := `SELECT id, my_event_id, name, phone, phone_clean, relationship, amount, payment_method,
		COALESCE(attendance, '직접 참석'), is_thanked, member_side, notes, created_at, updated_at
		FROM received
		WHERE my_event_id=? AND deleted_at IS NULL`
	var args []any
	args = append(args, myEventId)

	if search != "" {
		query += ` AND (name LIKE ? OR phone LIKE ? OR relationship LIKE ? OR notes LIKE ? OR attendance LIKE ?)`
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern, pattern, pattern, pattern)
	}
	query += ` ORDER BY id DESC`

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []ReceivedItem
	for rows.Next() {
		var item ReceivedItem
		var thankedInt int
		if err := rows.Scan(&item.ID, &item.MyEventID, &item.Name, &item.Phone, &item.PhoneClean,
			&item.Relationship, &item.Amount, &item.PaymentMethod, &item.Attendance, &thankedInt, &item.MemberSide,
			&item.Notes, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		item.IsThanked = (thankedInt == 1)
		list = append(list, item)
	}
	return list, rows.Err()
}

// CreateReceived 는 새 받은 내역 1건을 저장합니다.
func (s *Service) CreateReceived(myEventId int64, name, phone, relationship string, amount int64, paymentMethod string, attendance string, isThanked bool, memberSide, notes string) (*ReceivedItem, error) {
	if name == "" {
		return nil, fmt.Errorf("축의·부의자 이름을 입력해주세요.")
	}
	if relationship == "" {
		relationship = "지인"
	}
	if paymentMethod == "" {
		paymentMethod = "현금"
	}
	if attendance == "" {
		attendance = "직접 참석"
	}
	now := time.Now().Format(time.RFC3339)
	clean := cleanPhone(phone)
	thankedInt := 0
	if isThanked {
		thankedInt = 1
	}

	res, err := s.db.Exec(`INSERT INTO received(my_event_id, name, phone, phone_clean, relationship, amount, payment_method, attendance, is_thanked, member_side, notes, created_at, updated_at)
		VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		myEventId, name, phone, clean, relationship, amount, paymentMethod, attendance, thankedInt, memberSide, notes, now, now)
	if err != nil {
		return nil, fmt.Errorf("축의·부의금 내역 추가 실패: %w", err)
	}
	id, _ := res.LastInsertId()
	item := &ReceivedItem{
		ID:            id,
		MyEventID:     myEventId,
		Name:          name,
		Phone:         phone,
		PhoneClean:    clean,
		Relationship:  relationship,
		Amount:        amount,
		PaymentMethod: paymentMethod,
		Attendance:    attendance,
		IsThanked:     isThanked,
		MemberSide:    memberSide,
		Notes:         notes,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	s.bus.Publish("myevent", EventReceivedCreated, item)
	return item, nil
}

// UpdateReceived 는 받은 내역 정보를 수정합니다.
func (s *Service) UpdateReceived(id int64, name, phone, relationship string, amount int64, paymentMethod string, attendance string, isThanked bool, memberSide, notes string) error {
	now := time.Now().Format(time.RFC3339)
	clean := cleanPhone(phone)
	thankedInt := 0
	if isThanked {
		thankedInt = 1
	}
	if attendance == "" {
		attendance = "직접 참석"
	}

	_, err := s.db.Exec(`UPDATE received SET name=?, phone=?, phone_clean=?, relationship=?, amount=?, payment_method=?, attendance=?, is_thanked=?, member_side=?, notes=?, updated_at=?
		WHERE id=?`, name, phone, clean, relationship, amount, paymentMethod, attendance, thankedInt, memberSide, notes, now, id)
	if err != nil {
		return fmt.Errorf("축의·부의금 내역 수정 실패: %w", err)
	}
	s.bus.Publish("myevent", EventReceivedUpdated, map[string]any{"id": id, "name": name, "amount": amount})
	return nil
}

// DeleteReceived 는 내역 1건을 휴지통으로 보냅니다.
func (s *Service) DeleteReceived(id int64) error {
	now := time.Now().Format(time.RFC3339)
	_, err := s.db.Exec(`UPDATE received SET deleted_at=? WHERE id=?`, now, id)
	if err != nil {
		return fmt.Errorf("받은 내역 삭제 실패: %w", err)
	}
	s.bus.Publish("myevent", EventReceivedDeleted, map[string]any{"id": id})
	return nil
}

// ToggleThanked 는 답례/감사 인사 여부를 간편히 토글합니다.
func (s *Service) ToggleThanked(id int64) error {
	now := time.Now().Format(time.RFC3339)
	_, err := s.db.Exec(`UPDATE received SET is_thanked = CASE WHEN is_thanked=1 THEN 0 ELSE 1 END, updated_at=? WHERE id=?`, now, id)
	if err != nil {
		return err
	}
	s.bus.Publish("myevent", EventReceivedUpdated, map[string]any{"id": id, "toggledThanked": true})
	return nil
}
