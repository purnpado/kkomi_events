// 프론트엔드 이벤트 버스
// - 화면 모듈끼리 직접 부르지 않고 이벤트로만 소통합니다.
// - Go 이벤트 버스에서 온 이벤트(Wails "kkomi:event")도 같은 버스로 들어옵니다.
//
// 이벤트 이름 규칙: "<모듈>.<동작>"  예) received.created
// 구독 패턴: 정확한 이름 / "received.*" / "*"

const subscribers = new Set();
const recent = []; // 최근 이벤트 기록 (개발 확인용)
const RECENT_MAX = 50;

/** 패턴과 이벤트 이름이 맞는지 확인 */
export function match(pattern, topic) {
  if (pattern === '*' || pattern === topic) return true;
  if (pattern.endsWith('.*')) return topic.startsWith(pattern.slice(0, -1));
  return false;
}

/** 이벤트 구독. 반환된 함수를 호출하면 구독 해제 */
export function on(pattern, handler) {
  const sub = { pattern, handler };
  subscribers.add(sub);
  return () => subscribers.delete(sub);
}

/** 이벤트를 구독자에게 전달 (내부용) */
function dispatch(event) {
  recent.unshift(event);
  if (recent.length > RECENT_MAX) recent.pop();
  for (const sub of [...subscribers]) {
    if (!match(sub.pattern, event.topic)) continue;
    try {
      sub.handler(event);
    } catch (err) {
      console.error('[이벤트 처리 오류]', event.topic, err);
    }
  }
}

/** 화면 안에서 이벤트 발행 */
export function emit(topic, payload = null, source = 'frontend') {
  dispatch({ topic, payload, source, at: new Date().toISOString() });
}

/** 최근 이벤트 목록 */
export function recentEvents() {
  return [...recent];
}

let connected = false;
/** Go 이벤트 버스와 연결 (앱 시작 시 한 번 호출) */
export function connectBackend() {
  if (connected) return;
  const rt = window.runtime;
  if (!rt || typeof rt.EventsOn !== 'function') {
    console.warn('Wails 런타임이 없어 백엔드 이벤트 연결을 건너뜁니다. (브라우저 미리보기)');
    return;
  }
  rt.EventsOn('kkomi:event', (e) => dispatch({ ...e, fromBackend: true }));
  connected = true;
}
