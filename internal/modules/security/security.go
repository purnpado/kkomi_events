// Package security 는 4자리 PIN 번호 및 화면 잠금/자동 잠금을 관리하는 모듈입니다.
package security

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"time"

	"kkomi-events/internal/core/db"
	"kkomi-events/internal/core/eventbus"
	"kkomi-events/internal/core/module"
)

var (
	pinRegex = regexp.MustCompile(`^[0-9]{4}$`)

	ErrInvalidPinFormat = errors.New("PIN 번호는 4자리 숫자여야 합니다.")
	ErrPinAlreadySet    = errors.New("이미 PIN 번호가 설정되어 있습니다. 변경 기능을 사용하세요.")
	ErrPinNotSet        = errors.New("PIN 번호가 설정되지 않았습니다.")
	ErrWrongPin         = errors.New("PIN 번호가 일치하지 않습니다.")
	ErrLockedOut        = errors.New("연속 5회 실패로 30초 동안 잠겼습니다. 잠시 후 다시 시도해 주세요.")
)

// SecurityStatus 는 프론트엔드에 전달되는 보안 상태 정보입니다.
type SecurityStatus struct {
	IsPinSet        bool `json:"isPinSet"`
	Enabled         bool `json:"enabled"`
	AutoLockMinutes int  `json:"autoLockMinutes"`
	FailCount       int  `json:"failCount"`
	IsLockedOut     bool `json:"isLockedOut"`
	LockoutSeconds  int  `json:"lockoutSeconds"`
}

// Module 은 보안 모듈입니다.
type Module struct {
	svc *Service
}

// New 는 보안 모듈을 만듭니다.
func New() *Module {
	return &Module{svc: &Service{}}
}

// Name 은 모듈 이름입니다.
func (m *Module) Name() string {
	return "security"
}

// Migrations 는 보안 인증 테이블을 생성합니다.
func (m *Module) Migrations() []db.Migration {
	return []db.Migration{
		{
			Version: 1,
			Name:    "보안 PIN 테이블 생성",
			SQL: `CREATE TABLE IF NOT EXISTS security_auth (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				pin_hash TEXT NOT NULL,
				salt TEXT NOT NULL,
				enabled INTEGER NOT NULL DEFAULT 1,
				auto_lock_minutes INTEGER NOT NULL DEFAULT 5,
				fail_count INTEGER NOT NULL DEFAULT 0,
				locked_until TEXT NOT NULL DEFAULT '',
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);`,
		},
	}
}

// Init 은 서비스에 DB 및 이벤트 버스를 주입합니다.
func (m *Module) Init(c *module.Context) error {
	m.svc.db = c.DB
	m.svc.bus = c.Bus
	return nil
}

// Binding 은 화면에서 호출할 Wails 서비스입니다.
func (m *Module) Binding() any {
	return m.svc
}

// Service 는 화면에서 호출하는 보안 API 메서드 집합입니다.
type Service struct {
	db  *sql.DB
	bus *eventbus.Bus
}

// GetStatus 는 현재 PIN 설정 여부 및 잠금 설정을 조회합니다.
func (s *Service) GetStatus() (*SecurityStatus, error) {
	var hash, salt, lockedUntil string
	var enabled, autoLockMin, failCount int

	err := s.db.QueryRow(`
		SELECT pin_hash, salt, enabled, auto_lock_minutes, fail_count, locked_until 
		FROM security_auth WHERE id = 1
	`).Scan(&hash, &salt, &enabled, &autoLockMin, &failCount, &lockedUntil)

	if err == sql.ErrNoRows {
		return &SecurityStatus{
			IsPinSet:        false,
			Enabled:         false,
			AutoLockMinutes: 5,
			FailCount:       0,
			IsLockedOut:     false,
			LockoutSeconds:  0,
		}, nil
	}
	if err != nil {
		return nil, err
	}

	isLockedOut := false
	lockoutSec := 0
	if lockedUntil != "" {
		if t, parseErr := time.Parse(time.RFC3339, lockedUntil); parseErr == nil {
			rem := time.Until(t)
			if rem > 0 {
				isLockedOut = true
				lockoutSec = int(rem.Seconds()) + 1
			}
		}
	}

	return &SecurityStatus{
		IsPinSet:        hash != "",
		Enabled:         enabled == 1,
		AutoLockMinutes: autoLockMin,
		FailCount:       failCount,
		IsLockedOut:     isLockedOut,
		LockoutSeconds:  lockoutSec,
	}, nil
}

// SetupInitialPin 은 처음 프로그램 실행 시 4자리 PIN을 등록합니다.
func (s *Service) SetupInitialPin(pin string) error {
	if !pinRegex.MatchString(pin) {
		return ErrInvalidPinFormat
	}

	var count int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM security_auth WHERE id = 1 AND pin_hash != ''`).Scan(&count)
	if err == nil && count > 0 {
		return ErrPinAlreadySet
	}

	salt, err := generateSalt(16)
	if err != nil {
		return fmt.Errorf("솔트 생성 실패: %w", err)
	}

	hash := hashPin(pin, salt)
	now := time.Now().Format(time.RFC3339)

	_, err = s.db.Exec(`
		INSERT INTO security_auth (id, pin_hash, salt, enabled, auto_lock_minutes, fail_count, locked_until, created_at, updated_at)
		VALUES (1, ?, ?, 1, 5, 0, '', ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			pin_hash = excluded.pin_hash,
			salt = excluded.salt,
			enabled = 1,
			auto_lock_minutes = 5,
			fail_count = 0,
			locked_until = '',
			updated_at = excluded.updated_at
	`, hash, salt, now, now)

	if err != nil {
		return err
	}

	if s.bus != nil {
		s.bus.Publish("security", "security.changed", map[string]any{"action": "setup"})
	}
	return nil
}

// VerifyPin 은 화면 잠금 해제를 위해 사용자가 입력한 4자리 PIN을 검증합니다.
func (s *Service) VerifyPin(pin string) (bool, error) {
	if !pinRegex.MatchString(pin) {
		return false, ErrInvalidPinFormat
	}

	var hash, salt, lockedUntil string
	var failCount int
	err := s.db.QueryRow(`
		SELECT pin_hash, salt, fail_count, locked_until 
		FROM security_auth WHERE id = 1
	`).Scan(&hash, &salt, &failCount, &lockedUntil)

	if err == sql.ErrNoRows || hash == "" {
		return false, ErrPinNotSet
	}
	if err != nil {
		return false, err
	}

	// 일시 잠금 검사
	if lockedUntil != "" {
		if t, parseErr := time.Parse(time.RFC3339, lockedUntil); parseErr == nil {
			if time.Now().Before(t) {
				return false, ErrLockedOut
			}
		}
	}

	expectedHash := hashPin(pin, salt)
	now := time.Now().Format(time.RFC3339)

	if expectedHash != hash {
		failCount++
		newLockedUntil := ""
		if failCount >= 5 {
			newLockedUntil = time.Now().Add(30 * time.Second).Format(time.RFC3339)
		}
		_, _ = s.db.Exec(`UPDATE security_auth SET fail_count = ?, locked_until = ?, updated_at = ? WHERE id = 1`,
			failCount, newLockedUntil, now)

		if failCount >= 5 {
			return false, ErrLockedOut
		}
		return false, ErrWrongPin
	}

	// 인증 성공 시 실패 카운트 초기화
	_, _ = s.db.Exec(`UPDATE security_auth SET fail_count = 0, locked_until = '', updated_at = ? WHERE id = 1`, now)
	return true, nil
}

// ChangePin 은 기존 PIN을 확인한 후 새 4자리 PIN으로 변경합니다.
func (s *Service) ChangePin(oldPin, newPin string) error {
	ok, err := s.VerifyPin(oldPin)
	if err != nil {
		return err
	}
	if !ok {
		return ErrWrongPin
	}
	if !pinRegex.MatchString(newPin) {
		return ErrInvalidPinFormat
	}

	newSalt, err := generateSalt(16)
	if err != nil {
		return fmt.Errorf("솔트 생성 실패: %w", err)
	}

	newHash := hashPin(newPin, newSalt)
	now := time.Now().Format(time.RFC3339)

	_, err = s.db.Exec(`
		UPDATE security_auth 
		SET pin_hash = ?, salt = ?, fail_count = 0, locked_until = '', updated_at = ?
		WHERE id = 1
	`, newHash, newSalt, now)
	if err != nil {
		return err
	}

	if s.bus != nil {
		s.bus.Publish("security", "security.changed", map[string]any{"action": "changed"})
	}
	return nil
}

// UpdateConfig 는 잠금 기능 사용 여부 및 자동 잠금 대기 시간을 변경합니다.
func (s *Service) UpdateConfig(enabled bool, autoLockMinutes int, currentPin string) error {
	ok, err := s.VerifyPin(currentPin)
	if err != nil {
		return err
	}
	if !ok {
		return ErrWrongPin
	}

	if autoLockMinutes < 0 {
		autoLockMinutes = 0
	}
	enabledInt := 0
	if enabled {
		enabledInt = 1
	}

	now := time.Now().Format(time.RFC3339)
	_, err = s.db.Exec(`
		UPDATE security_auth 
		SET enabled = ?, auto_lock_minutes = ?, updated_at = ? 
		WHERE id = 1
	`, enabledInt, autoLockMinutes, now)
	if err != nil {
		return err
	}

	if s.bus != nil {
		s.bus.Publish("security", "security.changed", map[string]any{"action": "config"})
	}
	return nil
}

// ResetForDebug 는 테스트용으로 PIN 설정을 초기화합니다.
func (s *Service) ResetForDebug() error {
	_, err := s.db.Exec(`DELETE FROM security_auth WHERE id = 1`)
	return err
}

// 솔트 생성
func generateSalt(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// SHA-256 (PIN + Salt) 해시 계산
func hashPin(pin, salt string) string {
	h := sha256.New()
	h.Write([]byte(pin + ":" + salt))
	return hex.EncodeToString(h.Sum(nil))
}
