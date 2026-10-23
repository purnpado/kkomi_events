// Package eventtype 은 경조사 종류(탭 목록)를 관리하는 모듈입니다.
// 사용자가 탭을 추가, 이름 변경, 순서 변경, 숨기기, 삭제할 수 있습니다.
package eventtype

import (
	"database/sql"
	"fmt"
	"time"

	"kkomi-events/internal/core/db"
	"kkomi-events/internal/core/eventbus"
	"kkomi-events/internal/core/module"
)

// 이벤트 이름 상수
const (
	EventCreated   = "eventtype.created"
	EventUpdated   = "eventtype.updated"
	EventDeleted   = "eventtype.deleted"
	EventReordered = "eventtype.reordered"
)

// EventType 은 경조사 종류(탭) 구조체입니다.
type EventType struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Icon      string `json:"icon"`
	Color     string `json:"color"`
	SortOrder int    `json:"sortOrder"`
	IsHidden  bool   `json:"isHidden"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// Module 은 경조사 종류 모듈입니다.
type Module struct {
	svc *Service
}

// New 는 새 eventtype 모듈을 만듭니다.
func New() *Module {
	return &Module{svc: &Service{}}
}

// Name 은 모듈 이름입니다.
func (m *Module) Name() string { return "eventtype" }

// Migrations 는 DB 테이블 생성 SQL입니다.
func (m *Module) Migrations() []db.Migration {
	return []db.Migration{
		{
			Version: 1,
			Name:    "경조사 종류(탭) 테이블 생성",
			SQL: `CREATE TABLE event_type (
				id          INTEGER PRIMARY KEY AUTOINCREMENT,
				name        TEXT NOT NULL UNIQUE,
				icon        TEXT NOT NULL DEFAULT '🎉',
				color       TEXT NOT NULL DEFAULT '#E86343',
				sort_order  INTEGER NOT NULL DEFAULT 0,
				is_hidden   INTEGER NOT NULL DEFAULT 0,
				created_at  TEXT NOT NULL,
				updated_at  TEXT NOT NULL
			);`,
		},
	}
}

// Init 은 초기 기본 탭(결혼, 돌잔치, 장례식 등)을 등록합니다.
func (m *Module) Init(c *module.Context) error {
	m.svc.db = c.DB
	m.svc.bus = c.Bus

	defaultTypes := []struct {
		name, icon, color string
	}{
		{"결혼", "💍", "#E86343"},
		{"돌잔치", "👶", "#F59E0B"},
		{"장례식", "🕯️", "#4B5563"},
		{"회갑/칠순", "🎂", "#EC4899"},
		{"집들이", "🏠", "#10B981"},
		{"개업", "🎊", "#8B5CF6"},
		{"기타", "💌", "#6B7280"},
	}

	now := time.Now().Format(time.RFC3339)
	for i, dt := range defaultTypes {
		_, err := c.DB.Exec(`INSERT OR IGNORE INTO event_type(name, icon, color, sort_order, created_at, updated_at)
			VALUES(?,?,?,?,?,?)`, dt.name, dt.icon, dt.color, i+1, now, now)
		if err != nil {
			return fmt.Errorf("기본 경조사 탭 생성 실패(%s): %w", dt.name, err)
		}
	}
	return nil
}

// Binding 은 Wails에서 호출할 서비스 구조체를 돌려줍니다.
func (m *Module) Binding() any { return m.svc }

// Service 는 화면에서 호출하는 함수 모음입니다.
type Service struct {
	db  *sql.DB
	bus *eventbus.Bus
}

// List 는 경조사 탭 목록을 순서대로 돌려줍니다.
func (s *Service) List(includeHidden bool) ([]EventType, error) {
	query := `SELECT id, name, icon, color, sort_order, is_hidden, created_at, updated_at
		FROM event_type`
	if !includeHidden {
		query += ` WHERE is_hidden = 0`
	}
	query += ` ORDER BY sort_order ASC, id ASC`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []EventType
	for rows.Next() {
		var et EventType
		var isHiddenInt int
		if err := rows.Scan(&et.ID, &et.Name, &et.Icon, &et.Color, &et.SortOrder, &isHiddenInt, &et.CreatedAt, &et.UpdatedAt); err != nil {
			return nil, err
		}
		et.IsHidden = (isHiddenInt == 1)
		list = append(list, et)
	}
	return list, rows.Err()
}

// Create 는 새 경조사 탭을 만듭니다.
func (s *Service) Create(name, icon, color string) (*EventType, error) {
	if name == "" {
		return nil, fmt.Errorf("경조사 종류 이름을 입력해주세요.")
	}
	if icon == "" {
		icon = "🎉"
	}
	if color == "" {
		color = "#E86343"
	}
	var maxOrder int
	_ = s.db.QueryRow(`SELECT COALESCE(MAX(sort_order), 0) FROM event_type`).Scan(&maxOrder)

	now := time.Now().Format(time.RFC3339)
	res, err := s.db.Exec(`INSERT INTO event_type(name, icon, color, sort_order, is_hidden, created_at, updated_at)
		VALUES(?,?,?,?,0,?,?)`, name, icon, color, maxOrder+1, now, now)
	if err != nil {
		return nil, fmt.Errorf("경조사 종류 추가 실패: %w", err)
	}
	id, _ := res.LastInsertId()
	et := &EventType{
		ID:        id,
		Name:      name,
		Icon:      icon,
		Color:     color,
		SortOrder: maxOrder + 1,
		IsHidden:  false,
		CreatedAt: now,
		UpdatedAt: now,
	}
	s.bus.Publish("eventtype", EventCreated, et)
	return et, nil
}

// Update 는 탭 이름, 아이콘, 색상, 숨김 상태를 변경합니다.
func (s *Service) Update(id int64, name, icon, color string, isHidden bool) error {
	now := time.Now().Format(time.RFC3339)
	hiddenInt := 0
	if isHidden {
		hiddenInt = 1
	}
	_, err := s.db.Exec(`UPDATE event_type SET name=?, icon=?, color=?, is_hidden=?, updated_at=? WHERE id=?`,
		name, icon, color, hiddenInt, now, id)
	if err != nil {
		return fmt.Errorf("경조사 종류 수정 실패: %w", err)
	}
	s.bus.Publish("eventtype", EventUpdated, map[string]any{"id": id, "name": name, "isHidden": isHidden})
	return nil
}

// Reorder 는 탭 순서를 변경합니다.
func (s *Service) Reorder(ids []int64) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := time.Now().Format(time.RFC3339)
	for i, id := range ids {
		if _, err := tx.Exec(`UPDATE event_type SET sort_order=?, updated_at=? WHERE id=?`, i+1, now, id); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	s.bus.Publish("eventtype", EventReordered, ids)
	return nil
}

// Delete 는 탭을 삭제합니다. (기록이 있는 경우 방지)
func (s *Service) Delete(id int64) error {
	// 사용 중인 내 경조사 행사 확인
	var myCount int
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM my_event WHERE event_type_id=? AND deleted_at IS NULL`, id).Scan(&myCount)
	if myCount > 0 {
		return fmt.Errorf("해당 탭에 등록된 나의 경조사 행사가 %d건 있습니다. 삭제하려면 행사를 먼저 삭제하거나 변경해주세요.", myCount)
	}

	// 사용 중인 타인 경조사 확인
	var sentCount int
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM sent WHERE event_type_id=? AND deleted_at IS NULL`, id).Scan(&sentCount)
	if sentCount > 0 {
		return fmt.Errorf("해당 종류로 등록된 타인 경조사 내역이 %d건 있습니다.", sentCount)
	}

	_, err := s.db.Exec(`DELETE FROM event_type WHERE id=?`, id)
	if err != nil {
		return fmt.Errorf("경조사 종류 삭제 실패: %w", err)
	}
	s.bus.Publish("eventtype", EventDeleted, map[string]any{"id": id})
	return nil
}
