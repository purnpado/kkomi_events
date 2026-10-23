package eventbus

import "testing"

// 패턴 일치 규칙 테스트
func TestMatch(t *testing.T) {
	cases := []struct {
		pattern, topic string
		want           bool
	}{
		{"*", "received.created", true},
		{"received.created", "received.created", true},
		{"received.*", "received.deleted", true},
		{"received.*", "sent.created", false},
		{"received.created", "received.deleted", false},
	}
	for _, c := range cases {
		if got := Match(c.pattern, c.topic); got != c.want {
			t.Errorf("Match(%q,%q)=%v, 기대값 %v", c.pattern, c.topic, got, c.want)
		}
	}
}

// 발행/구독/해제 및 panic 격리 테스트
func TestPublishSubscribe(t *testing.T) {
	b := New(nil)
	count := 0
	b.Subscribe("a.*", func(e Event) { panic("일부러 오류") })
	off := b.Subscribe("a.*", func(e Event) { count++ })

	b.Publish("test", "a.x", nil)
	if count != 1 {
		t.Fatalf("구독자 호출 횟수 %d, 기대값 1", count)
	}
	off()
	b.Publish("test", "a.x", nil)
	if count != 1 {
		t.Fatalf("구독 해제 후에도 호출됨")
	}
}
