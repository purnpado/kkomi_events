package db

import (
	"os"
	"path/filepath"
	"testing"
)

// 한글 + 띄어쓰기 경로에서 DB 생성 및 마이그레이션이 잘 되는지 확인
func TestOpenKoreanPathAndMigrate(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "꼬미 경조사 폴더")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(dir, "테스트 장부.db")

	conn, err := Open(file)
	if err != nil {
		t.Fatalf("DB 열기 실패: %v", err)
	}
	defer conn.Close()

	migs := []Migration{{Module: "test", Version: 1, Name: "표 생성", SQL: `CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)`}}
	if err := Migrate(conn, migs); err != nil {
		t.Fatal(err)
	}
	// 두 번 실행해도 중복 적용되지 않아야 함
	if err := Migrate(conn, migs); err != nil {
		t.Fatalf("중복 마이그레이션 오류: %v", err)
	}
	if _, err := conn.Exec(`INSERT INTO t(name) VALUES('홍길동')`); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(file); err != nil {
		t.Fatalf("DB 파일이 한글 경로에 생성되지 않음: %v", err)
	}
	list, _ := Applied(conn)
	if len(list) != 1 {
		t.Fatalf("적용 기록 %d개, 기대값 1", len(list))
	}
}
