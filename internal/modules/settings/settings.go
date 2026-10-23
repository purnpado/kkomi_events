// Package settings 는 프로그램 설정(키-값)을 저장하는 모듈입니다.
// 설정이 바뀌면 "settings.changed" 이벤트를 발행합니다.
package settings

import (
	"database/sql"
	"time"

	"kkomi-events/internal/core/db"
	"kkomi-events/internal/core/eventbus"
	"kkomi-events/internal/core/module"
)

// 이벤트 이름
const (
	EventChanged = "settings.changed"
)

// ChangedPayload 는 settings.changed 이벤트 데이터입니다.
type ChangedPayload struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// 기본 설정값 (최초 실행 시 저장)
var defaults = map[string]string{
	"theme":       "light", // 테마: light / dark
	"usage_mode":  "solo",  // 사용 방식: solo(혼자) / shared(함께)
	"font_scale":  "1",     // 글자 크기 배율
	"trash_days":  "30",    // 휴지통 보관 일수
	"backup_keep": "30",    // 자동 백업 보관 개수
}

// Module 은 설정 모듈입니다.
type Module struct {
	svc *Service
}

// New 는 설정 모듈을 만듭니다.
func New() *Module { return &Module{svc: &Service{}} }

// Name 은 모듈 이름입니다.
func (m *Module) Name() string { return "settings" }

// Migrations 는 설정 테이블을 만듭니다.
func (m *Module) Migrations() []db.Migration {
	return []db.Migration{{
		Version: 1,
		Name:    "설정 테이블 생성",
		SQL: `CREATE TABLE setting (
			key        TEXT PRIMARY KEY,
			value      TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,
	}}
}

// Init 은 기본값을 채워 넣습니다.
func (m *Module) Init(c *module.Context) error {
	m.svc.db = c.DB
	m.svc.bus = c.Bus
	now := time.Now().Format(time.RFC3339)
	for k, v := range defaults {
		if _, err := c.DB.Exec(`INSERT OR IGNORE INTO setting(key, value, updated_at) VALUES(?,?,?)`, k, v, now); err != nil {
			return err
		}
	}
	return nil
}

// Binding 은 화면에서 호출할 서비스입니다.
func (m *Module) Binding() any { return m.svc }

// Service 는 화면에서 호출하는 설정 함수 모음입니다.
type Service struct {
	db  *sql.DB
	bus *eventbus.Bus
}

// GetAll 은 모든 설정을 돌려줍니다.
func (s *Service) GetAll() (map[string]string, error) {
	rows, err := s.db.Query(`SELECT key, value FROM setting`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]string{}
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		out[k] = v
	}
	return out, rows.Err()
}

// Get 은 설정값 하나를 돌려줍니다. 없으면 빈 문자열입니다.
func (s *Service) Get(key string) (string, error) {
	var v string
	err := s.db.QueryRow(`SELECT value FROM setting WHERE key=?`, key).Scan(&v)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return v, err
}

// Set 은 설정값을 저장하고 settings.changed 이벤트를 발행합니다.
func (s *Service) Set(key, value string) error {
	_, err := s.db.Exec(`INSERT INTO setting(key, value, updated_at) VALUES(?,?,?)
		ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
		key, value, time.Now().Format(time.RFC3339))
	if err != nil {
		return err
	}
	s.bus.Publish("settings", EventChanged, ChangedPayload{Key: key, Value: value})
	return nil
}
