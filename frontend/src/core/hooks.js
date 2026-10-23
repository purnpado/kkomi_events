// 공용 React 훅
import { useEffect, useRef } from 'react';
import { on } from './eventBus';

/**
 * 이벤트를 구독하는 훅. 컴포넌트가 사라지면 자동으로 구독 해제됩니다.
 * @param {string|string[]} pattern 구독 패턴 (여러 개 가능)
 * @param {(event:object)=>void} handler
 */
export function useBusEvent(pattern, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  const key = Array.isArray(pattern) ? pattern.join('|') : pattern;

  useEffect(() => {
    const list = key.split('|');
    const offs = list.map((p) => on(p, (e) => ref.current(e)));
    return () => offs.forEach((off) => off());
  }, [key]);
}
