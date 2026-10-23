package matching

import (
	"path/filepath"
	"testing"

	"kkomi-events/internal/core/db"
	"kkomi-events/internal/core/eventbus"
	"kkomi-events/internal/core/module"
	"kkomi-events/internal/modules/eventtype"
	"kkomi-events/internal/modules/myevent"
	"kkomi-events/internal/modules/sent"
)

// 내 경조사에 축의한 사람과 내가 보낸 축의금이 정확히 매칭되어
// 차액과 '갚을 차례'/'받을 차례' 상태가 올바르게 계산되는지 검증
func TestMatchingCalculation(t *testing.T) {
	dbFile := filepath.Join(t.TempDir(), "test_matching.db")
	conn, err := db.Open(dbFile)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()

	bus := eventbus.New(nil)
	reg := module.NewRegistry(
		eventtype.New(),
		myevent.New(),
		sent.New(),
		New(),
	)
	if err := reg.Setup(&module.Context{DB: conn, Bus: bus}); err != nil {
		t.Fatal(err)
	}

	mySvc := &myevent.Service{}
	// 리플렉션 대신 직접 서비스 필드 초기화
	myMod := myevent.New()
	_ = myMod.Init(&module.Context{DB: conn, Bus: bus})
	mySvc = myMod.Binding().(*myevent.Service)

	sentMod := sent.New()
	_ = sentMod.Init(&module.Context{DB: conn, Bus: bus})
	sentSvc := sentMod.Binding().(*sent.Service)

	matchMod := New()
	_ = matchMod.Init(&module.Context{DB: conn, Bus: bus})
	matchSvc := matchMod.Binding().(*Service)

	// 1. 내 결혼식 행사 등록
	ev, err := mySvc.CreateEvent(1, "우리 결혼식", "2026-10-25", "서울", "본인", "", "")
	if err != nil {
		t.Fatal(err)
	}

	// 2. 받은 내역 등록
	// 홍길동이 내 결혼식에 100,000원 입금
	_, err = mySvc.CreateReceived(ev.ID, "홍길동", "010-1234-5678", "친구", 100000, "현금", false, "", "")
	if err != nil {
		t.Fatal(err)
	}
	// 이영희가 내 결혼식에 50,000원 입금
	_, err = mySvc.CreateReceived(ev.ID, "이영희", "010-9999-8888", "동료", 50000, "계좌이체", false, "", "")
	if err != nil {
		t.Fatal(err)
	}

	// 3. 타인 경조사에 보낸 내역 등록
	// 내가 홍길동 돌잔치에 50,000원 보냄 (하이픈 없는 번호로 테스트)
	_, err = sentSvc.Create("홍길동", "01012345678", "친구", 2, "2026-11-01", 50000, "계좌이체", true, "", "")
	if err != nil {
		t.Fatal(err)
	}
	// 내가 김철수 결혼식에 100,000원 보냄 (김철수는 내 행사에 낸 적 없음)
	_, err = sentSvc.Create("김철수", "010-3333-4444", "선배", 1, "2026-11-15", 100000, "현금", true, "", "")
	if err != nil {
		t.Fatal(err)
	}

	// 4. 매칭 목록 검증
	summaries, err := matchSvc.ListSummaries("all", "")
	if err != nil {
		t.Fatal(err)
	}

	if len(summaries) != 3 {
		t.Fatalf("기대 인원 3명, 실제 %d명", len(summaries))
	}

	for _, s := range summaries {
		if s.Name == "홍길동" {
			// 홍길동: 내 행사 10만 받음, 그분 행사 5만 보냄 -> 잔액 +5만 (내가 갚을 차례!)
			if s.ReceivedTotal != 100000 || s.SentTotal != 50000 || s.Balance != 50000 {
				t.Errorf("홍길동 금액 불일치: 받음=%d, 보냄=%d, 잔액=%d", s.ReceivedTotal, s.SentTotal, s.Balance)
			}
			if s.Status != "need_pay" {
				t.Errorf("홍길동 상태 오류: %s (기대: need_pay)", s.Status)
			}
		} else if s.Name == "이영희" {
			// 이영희: 내 행사 5만 받음, 보낸 적 없음 -> 잔액 +5만 (갚을 차례)
			if s.ReceivedTotal != 50000 || s.SentTotal != 0 || s.Balance != 50000 {
				t.Errorf("이영희 금액 불일치: 받음=%d, 보냄=%d, 잔액=%d", s.ReceivedTotal, s.SentTotal, s.Balance)
			}
			if s.Status != "need_pay" {
				t.Errorf("이영희 상태 오류: %s", s.Status)
			}
		} else if s.Name == "김철수" {
			// 김철수: 받은 적 없음, 내가 10만 보냄 -> 잔액 -10만 (받을 차례)
			if s.ReceivedTotal != 0 || s.SentTotal != 100000 || s.Balance != -100000 {
				t.Errorf("김철수 금액 불일치: 받음=%d, 보냄=%d, 잔액=%d", s.ReceivedTotal, s.SentTotal, s.Balance)
			}
			if s.Status != "receive_back" {
				t.Errorf("김철수 상태 오류: %s", s.Status)
			}
		}
	}

	// 5. 힌트 메시지 검증
	hint, err := matchSvc.GetHintForName("홍길동", "01012345678")
	if err != nil {
		t.Fatal(err)
	}
	if hint == "" {
		t.Errorf("홍길동 힌트 메시지가 비어있음")
	}
	t.Logf("힌트 메시지 정상 생성: %s", hint)
}
