// Package customfield 는 사용자가 각 메뉴(나의 경조사, 타인 경조사)에
// 원하는 추가 항목(컬럼)을 자유롭게 생성하고 값을 기록할 수 있게 해주는 모듈입니다.
package customfield

import (
	"database/sql"
	"fmt"
	"time"

	"kkomi-events/internal/core/db"
	"kkomi-events/internal/core/eventbus"
	"kkomi-events/internal/core/module"
)

// 이벤트 이름
const (
	EventFieldCreated = "customfield.created"
	EventFieldDeleted = "customfield.deleted"
	EventValueChanged = "customfield.value_changed"
)

// CustomField 는 사용자가 추가한 항목 정의입니다.
type CustomField struct {
	ID         int64  `json:"id"`
	TargetMenu string `json:"targetMenu"` // "myevent" 또는 "sent"
	FieldName  string `json:"fieldName"`  // 예: "식권 매수", "방명록 번호", "답례품 종류"
	FieldType  string `json:"fieldType"`  // "text", "number", "date", "checkbox"
	SortOrder  int    `json:"sortOrder"`
	CreatedAt  string `json:"createdAt"`
}

// Module 은 사용자 항목 추가 모듈입니다.
type Module struct {
	svc *Service
}

func New() *Module {
	return &Module{svc: &Service{}}
}

func (m *Module) Name() string { return "customfield" }

func (m *Module) Migrations() []db.Migration {
	return []db.Migration{
		{
			Version: 1,
			Name:    "사용자 추가 항목 및 값 테이블 생성",
			SQL: `CREATE TABLE IF NOT EXISTS custom_field (
				id          INTEGER PRIMARY KEY AUTOINCREMENT,
				target_menu TEXT NOT NULL,
				field_name  TEXT NOT NULL,
				field_type  TEXT NOT NULL DEFAULT 'text',
				sort_order  INTEGER NOT NULL DEFAULT 0,
				created_at  TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS custom_field_value (
				field_id   INTEGER NOT NULL,
				record_id  INTEGER NOT NULL,
				val        TEXT NOT NULL DEFAULT '',
				PRIMARY KEY (field_id, record_id),
				FOREIGN KEY(field_id) REFERENCES custom_field(id) ON DELETE CASCADE
			);`,
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

// ListFields 는 특정 메뉴에 정의된 사용자 항목 목록을 돌려줍니다.
func (s *Service) ListFields(targetMenu string) ([]CustomField, error) {
	rows, err := s.db.Query(`SELECT id, target_menu, field_name, field_type, sort_order, created_at
		FROM custom_field WHERE target_menu=? ORDER BY sort_order ASC, id ASC`, targetMenu)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []CustomField
	for rows.Next() {
		var f CustomField
		if err := rows.Scan(&f.ID, &f.TargetMenu, &f.FieldName, &f.FieldType, &f.SortOrder, &f.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, f)
	}
	return list, rows.Err()
}

// CreateField 는 새 사용자 항목을 만듭니다.
func (s *Service) CreateField(targetMenu, fieldName, fieldType string) (*CustomField, error) {
	if fieldName == "" {
		return nil, fmt.Errorf("항목 이름을 입력해주세요.")
	}
	if fieldType == "" {
		fieldType = "text"
	}
	now := time.Now().Format(time.RFC3339)
	var maxOrder int
	_ = s.db.QueryRow(`SELECT COALESCE(MAX(sort_order), 0) FROM custom_field WHERE target_menu=?`, targetMenu).Scan(&maxOrder)

	res, err := s.db.Exec(`INSERT INTO custom_field(target_menu, field_name, field_type, sort_order, created_at)
		VALUES(?,?,?,?,?)`, targetMenu, fieldName, fieldType, maxOrder+1, now)
	if err != nil {
		return nil, fmt.Errorf("항목 추가 실패: %w", err)
	}
	id, _ := res.LastInsertId()
	f := &CustomField{
		ID:         id,
		TargetMenu: targetMenu,
		FieldName:  fieldName,
		FieldType:  fieldType,
		SortOrder:  maxOrder + 1,
		CreatedAt:  now,
	}
	s.bus.Publish("customfield", EventFieldCreated, f)
	return f, nil
}

// DeleteField 는 사용자 정의 항목과 저장된 값들을 삭제합니다.
func (s *Service) DeleteField(id int64) error {
	_, _ = s.db.Exec(`DELETE FROM custom_field_value WHERE field_id=?`, id)
	_, err := s.db.Exec(`DELETE FROM custom_field WHERE id=?`, id)
	if err != nil {
		return fmt.Errorf("항목 삭제 실패: %w", err)
	}
	s.bus.Publish("customfield", EventFieldDeleted, map[string]any{"id": id})
	return nil
}

// GetValuesForRecord 는 특정 레코드(받은내역 또는 보낸내역)의 사용자 항목 값들을 가져옵니다.
func (s *Service) GetValuesForRecord(recordId int64) (map[int64]string, error) {
	rows, err := s.db.Query(`SELECT field_id, val FROM custom_field_value WHERE record_id=?`, recordId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	vals := make(map[int64]string)
	for rows.Next() {
		var fId int64
		var v string
		if err := rows.Scan(&fId, &v); err == nil {
			vals[fId] = v
		}
	}
	return vals, nil
}

// SaveValue 는 특정 레코드의 사용자 항목 값 1건을 저장합니다.
func (s *Service) SaveValue(fieldId, recordId int64, value string) error {
	_, err := s.db.Exec(`INSERT INTO custom_field_value(field_id, record_id, val) VALUES(?,?,?)
		ON CONFLICT(field_id, record_id) DO UPDATE SET val=excluded.val`, fieldId, recordId, value)
	if err != nil {
		return err
	}
	s.bus.Publish("customfield", EventValueChanged, map[string]any{"fieldId": fieldId, "recordId": recordId})
	return nil
}
