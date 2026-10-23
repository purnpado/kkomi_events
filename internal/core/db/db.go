// Package db 는 SQLite 연결과 모듈별 DB 마이그레이션(테이블 생성/변경)을 담당합니다.
// 순수 Go SQLite(modernc.org/sqlite)를 사용하므로 C 컴파일러가 필요 없습니다.
package db

import (
	"database/sql"
	"fmt"
	"sort"
	"time"

	_ "modernc.org/sqlite" // SQLite 드라이버 등록
)

// Open 은 SQLite DB 파일을 엽니다. 파일이 없으면 빈 DB 를 새로 만듭니다.
// 경로는 "file:" URI 가 아닌 일반 경로로 넘기므로 한글/공백 폴더명도 안전합니다.
func Open(file string) (*sql.DB, error) {
	dsn := file +
		"?_pragma=foreign_keys(1)" +
		"&_pragma=journal_mode(WAL)" +
		"&_pragma=busy_timeout(5000)" +
		"&_pragma=synchronous(NORMAL)"

	conn, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("DB 열기 실패: %w", err)
	}
	// 데스크톱 단일 사용자 프로그램이므로 연결 1개로 잠금 문제를 예방
	conn.SetMaxOpenConns(1)
	if err := conn.Ping(); err != nil {
		conn.Close()
		return nil, fmt.Errorf("DB 연결 확인 실패: %w", err)
	}
	return conn, nil
}

// Migration 은 모듈이 자기 테이블을 만들거나 바꾸는 SQL 한 묶음입니다.
// (모듈 이름 + 버전) 조합으로 한 번만 실행됩니다.
type Migration struct {
	Module  string
	Version int
	Name    string
	SQL     string
}

// AppliedMigration 은 이미 적용된 마이그레이션 기록입니다.
type AppliedMigration struct {
	Module    string `json:"module"`
	Version   int    `json:"version"`
	Name      string `json:"name"`
	AppliedAt string `json:"appliedAt"`
}

// Migrate 는 아직 적용되지 않은 마이그레이션을 모듈/버전 순으로 실행합니다.
func Migrate(conn *sql.DB, migs []Migration) error {
	if _, err := conn.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		module     TEXT    NOT NULL,
		version    INTEGER NOT NULL,
		name       TEXT    NOT NULL,
		applied_at TEXT    NOT NULL,
		PRIMARY KEY (module, version)
	)`); err != nil {
		return fmt.Errorf("마이그레이션 표 생성 실패: %w", err)
	}

	sorted := append([]Migration(nil), migs...)
	sort.SliceStable(sorted, func(i, j int) bool {
		if sorted[i].Module != sorted[j].Module {
			return sorted[i].Module < sorted[j].Module
		}
		return sorted[i].Version < sorted[j].Version
	})

	for _, m := range sorted {
		var n int
		if err := conn.QueryRow(`SELECT COUNT(*) FROM schema_migrations WHERE module=? AND version=?`,
			m.Module, m.Version).Scan(&n); err != nil {
			return err
		}
		if n > 0 {
			continue
		}
		tx, err := conn.Begin()
		if err != nil {
			return err
		}
		if _, err := tx.Exec(m.SQL); err != nil {
			tx.Rollback()
			return fmt.Errorf("마이그레이션 실패 [%s v%d %s]: %w", m.Module, m.Version, m.Name, err)
		}
		if _, err := tx.Exec(`INSERT INTO schema_migrations(module, version, name, applied_at) VALUES(?,?,?,?)`,
			m.Module, m.Version, m.Name, time.Now().Format(time.RFC3339)); err != nil {
			tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}

// Applied 는 적용된 마이그레이션 목록을 돌려줍니다.
func Applied(conn *sql.DB) ([]AppliedMigration, error) {
	rows, err := conn.Query(`SELECT module, version, name, applied_at FROM schema_migrations ORDER BY module, version`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []AppliedMigration
	for rows.Next() {
		var a AppliedMigration
		if err := rows.Scan(&a.Module, &a.Version, &a.Name, &a.AppliedAt); err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	return list, rows.Err()
}
