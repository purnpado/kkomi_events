// 화면 모듈 등록소
// 각 모듈(modules/<이름>/index.js)은 registerModule() 로 자신을 등록합니다.
// 등록된 모듈은 자동으로 왼쪽 메뉴에 나타납니다.

const modules = [];

/**
 * 모듈 등록
 * @param {object} def
 * @param {string} def.id        고유 이름 (백엔드 모듈 이름과 같게)
 * @param {string} def.title     메뉴에 보일 이름
 * @param {string} def.icon      메뉴 아이콘 (이모지)
 * @param {number} def.order     메뉴 순서 (작을수록 위)
 * @param {string} [def.section] 메뉴 묶음: 'main' | 'tools' | 'system'
 * @param {Function} def.Page    화면 컴포넌트
 * @param {Function} [def.setup] 등록 직후 실행 (이벤트 구독 등)
 */
export function registerModule(def) {
  if (modules.some((m) => m.id === def.id)) {
    console.warn('이미 등록된 모듈:', def.id);
    return;
  }
  modules.push({ section: 'main', ...def });
  modules.sort((a, b) => a.order - b.order);
  if (typeof def.setup === 'function') def.setup();
}

/** 등록된 모듈 목록 */
export function getModules() {
  return [...modules];
}

/** id 로 모듈 찾기 */
export function getModule(id) {
  return modules.find((m) => m.id === id);
}
