package eventtype_test

import (
	"database/sql"
	"testing"

	"kkomi-events/internal/core/db"
	"kkomi-events/internal/core/eventbus"
	"kkomi-events/internal/core/module"
	"kkomi-events/internal/modules/eventtype"
	"kkomi-events/internal/modules/settings"

	_ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T) (*sql.DB, *eventbus.Bus, *eventtype.Module) {
	conn, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("DB 열기 실패: %v", err)
	}

	settingMod := settings.New()
	etMod := eventtype.New()

	var migs []db.Migration
	for _, m := range settingMod.Migrations() {
		m.Module = "settings"
		migs = append(migs, m)
	}
	for _, m := range etMod.Migrations() {
		m.Module = "eventtype"
		migs = append(migs, m)
	}

	if err := db.Migrate(conn, migs); err != nil {
		t.Fatalf("마이그레이션 실패: %v", err)
	}

	bus := eventbus.New(nil)
	ctx := &module.Context{DB: conn, Bus: bus}

	if err := settingMod.Init(ctx); err != nil {
		t.Fatalf("setting Init 실패: %v", err)
	}
	if err := etMod.Init(ctx); err != nil {
		t.Fatalf("eventtype Init 실패: %v", err)
	}

	return conn, bus, etMod
}

func TestDeleteEventTypeNotRestoredOnReboot(t *testing.T) {
	conn, bus, etMod := setupTestDB(t)
	defer conn.Close()

	svc := etMod.Binding().(*eventtype.Service)

	// 초기 7개 탭 확인
	list, err := svc.List(true)
	if err != nil {
		t.Fatalf("List 실패: %v", err)
	}
	if len(list) != 7 {
		t.Fatalf("초기 탭 개수 예상 7개, 실제 %d개", len(list))
	}

	// '돌잔치' 탭 찾아서 삭제
	var dolId int64
	for _, item := range list {
		if item.Name == "돌잔치" {
			dolId = item.ID
			break
		}
	}
	if dolId == 0 {
		t.Fatalf("돌잔치 탭을 찾지 못함")
	}

	if err := svc.Delete(dolId); err != nil {
		t.Fatalf("돌잔치 탭 삭제 실패: %v", err)
	}

	// 삭제 후 6개 확인
	listAfter, err := svc.List(true)
	if err != nil {
		t.Fatalf("List 실패: %v", err)
	}
	if len(listAfter) != 6 {
		t.Fatalf("삭제 후 탭 개수 예상 6개, 실제 %d개", len(listAfter))
	}

	// 프로그램 재실행 시뮬레이션: 새 인스턴스로 Init 재호출
	newEtMod := eventtype.New()
	ctx := &module.Context{DB: conn, Bus: bus}
	if err := newEtMod.Init(ctx); err != nil {
		t.Fatalf("재실행 Init 실패: %v", err)
	}

	newSvc := newEtMod.Binding().(*eventtype.Service)
	rebootList, err := newSvc.List(true)
	if err != nil {
		t.Fatalf("재실행 후 List 실패: %v", err)
	}

	// 삭제된 돌잔치 탭이 다시 살아나지 않고 6개여야 함!
	if len(rebootList) != 6 {
		t.Fatalf("재실행 후 삭제된 탭이 다시 살아남! 예상 6개, 실제 %d개", len(rebootList))
	}
	for _, item := range rebootList {
		if item.Name == "돌잔치" {
			t.Fatalf("삭제했던 '돌잔치' 탭이 재실행 시 부활했습니다!")
		}
	}
}
