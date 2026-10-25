package security

import (
	"database/sql"
	"testing"

	"kkomi-events/internal/core/eventbus"
	"kkomi-events/internal/core/module"

	_ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T) (*Module, *sql.DB) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("테스트 DB 열기 실패: %v", err)
	}

	m := New()
	for _, mig := range m.Migrations() {
		if _, err := db.Exec(mig.SQL); err != nil {
			t.Fatalf("마이그레이션 실패: %v", err)
		}
	}

	bus := eventbus.New(nil)
	if err := m.Init(&module.Context{DB: db, Bus: bus}); err != nil {
		t.Fatalf("Init 실패: %v", err)
	}

	return m, db
}

func TestSecurityFlow(t *testing.T) {
	m, db := setupTestDB(t)
	defer db.Close()
	svc := m.Binding().(*Service)

	// 1. 초기 상태: PIN 미설정
	status, err := svc.GetStatus()
	if err != nil {
		t.Fatalf("GetStatus 실패: %v", err)
	}
	if status.IsPinSet {
		t.Errorf("초기 상태에서 isPinSet은 false여야 합니다.")
	}

	// 2. PIN 형식 검증 (4자리 숫자)
	if err := svc.SetupInitialPin("123"); err != ErrInvalidPinFormat {
		t.Errorf("3자리는 오류여야 합니다: %v", err)
	}
	if err := svc.SetupInitialPin("abcd"); err != ErrInvalidPinFormat {
		t.Errorf("문자는 오류여야 합니다: %v", err)
	}

	// 3. 정상 최초 설정
	if err := svc.SetupInitialPin("1234"); err != nil {
		t.Fatalf("SetupInitialPin 실패: %v", err)
	}

	// 4. 상태 재확인
	status, err = svc.GetStatus()
	if err != nil {
		t.Fatalf("GetStatus 실패: %v", err)
	}
	if !status.IsPinSet || !status.Enabled {
		t.Errorf("PIN 설정 후 isPinSet과 enabled는 true여야 합니다: %+v", status)
	}

	// 5. 검증 (맞는 번호 / 틀린 번호)
	ok, err := svc.VerifyPin("1234")
	if err != nil || !ok {
		t.Errorf("VerifyPin 1234 실패: ok=%v, err=%v", ok, err)
	}

	ok, err = svc.VerifyPin("9999")
	if err == nil || ok {
		t.Errorf("VerifyPin 9999는 실패해야 합니다: ok=%v, err=%v", ok, err)
	}

	// 6. PIN 변경
	if err := svc.ChangePin("1234", "5678"); err != nil {
		t.Fatalf("ChangePin 실패: %v", err)
	}
	// 이전 번호 불일치 확인
	ok, _ = svc.VerifyPin("1234")
	if ok {
		t.Errorf("구 번호 1234는 실패해야 합니다.")
	}
	// 새 번호 일치 확인
	ok, err = svc.VerifyPin("5678")
	if err != nil || !ok {
		t.Errorf("새 번호 5678은 통과해야 합니다.")
	}

	// 7. 설정 변경 (자동 잠금 시간 및 켜기/끄기)
	if err := svc.UpdateConfig(false, 10, "5678"); err != nil {
		t.Fatalf("UpdateConfig 실패: %v", err)
	}
	status, err = svc.GetStatus()
	if err != nil {
		t.Fatalf("GetStatus 실패: %v", err)
	}
	if status.Enabled != false || status.AutoLockMinutes != 10 {
		t.Errorf("설정 반영 실패: %+v", status)
	}
}
