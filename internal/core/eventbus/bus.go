// Package eventbus 는 모듈끼리 직접 호출하지 않고
// "이벤트"로만 소통하게 해 주는 발행/구독(pub/sub) 장치입니다.
//
// 이벤트 이름 규칙: "<모듈>.<동작>" (예: received.created)
// 구독 패턴:
//   - "received.created" : 정확히 일치
//   - "received.*"       : received 로 시작하는 모든 이벤트
//   - "*"                : 모든 이벤트
package eventbus

import (
	"log/slog"
	"strings"
	"sync"
	"time"
)

// Event 는 버스를 통해 전달되는 이벤트 한 건입니다.
type Event struct {
	Topic   string    `json:"topic"`   // 이벤트 이름
	Source  string    `json:"source"`  // 발행한 모듈 이름
	Payload any       `json:"payload"` // 이벤트 데이터
	At      time.Time `json:"at"`      // 발생 시각
}

// Handler 는 이벤트를 받아 처리하는 함수입니다.
type Handler func(Event)

type subscription struct {
	id      uint64
	pattern string
	handler Handler
}

// Bus 는 이벤트 버스입니다. 여러 고루틴에서 동시에 사용해도 안전합니다.
type Bus struct {
	mu     sync.RWMutex
	subs   []subscription
	nextID uint64
	log    *slog.Logger
}

// New 는 새 이벤트 버스를 만듭니다.
func New(log *slog.Logger) *Bus {
	if log == nil {
		log = slog.Default()
	}
	return &Bus{log: log}
}

// Subscribe 는 패턴에 맞는 이벤트를 구독합니다.
// 반환되는 함수를 호출하면 구독이 해제됩니다.
func (b *Bus) Subscribe(pattern string, h Handler) (unsubscribe func()) {
	b.mu.Lock()
	b.nextID++
	id := b.nextID
	b.subs = append(b.subs, subscription{id: id, pattern: pattern, handler: h})
	b.mu.Unlock()

	return func() {
		b.mu.Lock()
		defer b.mu.Unlock()
		for i, s := range b.subs {
			if s.id == id {
				b.subs = append(b.subs[:i], b.subs[i+1:]...)
				return
			}
		}
	}
}

// Publish 는 이벤트를 발행합니다. 구독자들은 등록 순서대로 호출되며,
// 한 구독자에서 오류(panic)가 나도 다른 구독자에게는 영향이 없습니다.
func (b *Bus) Publish(source, topic string, payload any) {
	e := Event{Topic: topic, Source: source, Payload: payload, At: time.Now()}

	b.mu.RLock()
	targets := make([]subscription, 0, len(b.subs))
	for _, s := range b.subs {
		if Match(s.pattern, topic) {
			targets = append(targets, s)
		}
	}
	b.mu.RUnlock()

	for _, s := range targets {
		b.safeCall(s, e)
	}
}

func (b *Bus) safeCall(s subscription, e Event) {
	defer func() {
		if r := recover(); r != nil {
			b.log.Error("이벤트 처리 중 오류", "topic", e.Topic, "pattern", s.pattern, "error", r)
		}
	}()
	s.handler(e)
}

// Match 는 구독 패턴과 이벤트 이름이 맞는지 확인합니다.
func Match(pattern, topic string) bool {
	if pattern == "*" || pattern == topic {
		return true
	}
	if strings.HasSuffix(pattern, ".*") {
		return strings.HasPrefix(topic, strings.TrimSuffix(pattern, "*"))
	}
	return false
}
