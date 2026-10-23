package trash_test

import (
	"database/sql"
	"testing"

	"kkomi-events/internal/core/db"
	"kkomi-events/internal/core/eventbus"
	"kkomi-events/internal/core/module"
	"kkomi-events/internal/modules/eventtype"
	"kkomi-events/internal/modules/myevent"
	"kkomi-events/internal/modules/sent"
	"kkomi-events/internal/modules/settings"
	"kkomi-events/internal/modules/trash"

	_ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T) (*sql.DB, *eventbus.Bus, *trash.Service, *sent.Service, *myevent.Service) {
	conn, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("DB 열기 실패: %v", err)
	}

	settingMod := settings.New()
	etMod := eventtype.New()
	sentMod := sent.New()
	myMod := myevent.New()
	trashMod := trash.New()

	var migs []db.Migration
	for _, m := range settingMod.Migrations() {
		m.Module = "settings"
		migs = append(migs, m)
	}
	for _, m := range etMod.Migrations() {
		m.Module = "eventtype"
		migs = append(migs, m)
	}
	for _, m := range myMod.Migrations() {
		m.Module = "myevent"
		migs = append(migs, m)
	}
	for _, m := range sentMod.Migrations() {
		m.Module = "sent"
		migs = append(migs, m)
	}

	if err := db.Migrate(conn, migs); err != nil {
		t.Fatalf("마이그레이션 실패: %v", err)
	}

	bus := eventbus.New(nil)
	ctx := &module.Context{DB: conn, Bus: bus}

	_ = settingMod.Init(ctx)
	_ = etMod.Init(ctx)
	_ = myMod.Init(ctx)
	_ = sentMod.Init(ctx)
	_ = trashMod.Init(ctx)

	trashSvc := trashMod.Binding().(*trash.Service)
	sentSvc := sentMod.Binding().(*sent.Service)
	mySvc := myMod.Binding().(*myevent.Service)

	return conn, bus, trashSvc, sentSvc, mySvc
}

func TestTrashListRestorePurge(t *testing.T) {
	conn, _, trashSvc, sentSvc, _ := setupTestDB(t)
	defer conn.Close()

	// 1. 타인 경조사 등록 후 삭제 -> 휴지통 이동 확인
	item, err := sentSvc.Create("홍길동", "010-1234-5678", "친구", 1, "2026-05-20", 100000, "계좌이체", true, "본인", "축하")
	if err != nil {
		t.Fatalf("sent.Create 실패: %v", err)
	}

	// 삭제 전 휴지통 건수 0
	count, _ := trashSvc.GetCount()
	if count != 0 {
		t.Fatalf("초기 휴지통 건수 예상 0, 실제 %d", count)
	}

	// 삭제 실행
	if err := sentSvc.Delete(item.ID); err != nil {
		t.Fatalf("sent.Delete 실패: %v", err)
	}

	// 삭제 후 휴지통 건수 1
	count, _ = trashSvc.GetCount()
	if count != 1 {
		t.Fatalf("삭제 후 휴지통 건수 예상 1, 실제 %d", count)
	}

	// 휴지통 목록 조회
	list, err := trashSvc.List()
	if err != nil || len(list) != 1 {
		t.Fatalf("trash.List 실패 또는 건수 불일치: %v", err)
	}
	if list[0].Title != "홍길동" || list[0].Amount != 100000 {
		t.Fatalf("휴지통 항목 내용 불일치: %+v", list[0])
	}

	// 복원 실행
	if err := trashSvc.Restore("sent", item.ID); err != nil {
		t.Fatalf("trash.Restore 실패: %v", err)
	}

	// 복원 후 휴지통 건수 0
	count, _ = trashSvc.GetCount()
	if count != 0 {
		t.Fatalf("복원 후 휴지통 건수 예상 0, 실제 %d", count)
	}

	// 다시 삭제 후 영구 삭제(Purge) 테스트
	_ = sentSvc.Delete(item.ID)
	if err := trashSvc.Purge("sent", item.ID); err != nil {
		t.Fatalf("trash.Purge 실패: %v", err)
	}
	count, _ = trashSvc.GetCount()
	if count != 0 {
		t.Fatalf("영구 삭제 후 휴지통 건수 예상 0, 실제 %d", count)
	}
}
