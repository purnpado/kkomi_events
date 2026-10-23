// 백엔드(Go) 호출 창구
// Wails 가 만들어 주는 window.go.<패키지>.<구조체>.<함수> 를 안전하게 감쌉니다.
// 브라우저 미리보기(백엔드 없음)에서도 화면이 깨지지 않도록 오류를 알기 쉽게 바꿉니다.

/**
 * 백엔드 함수 호출
 * @param {string} path 예) 'system.Service.GetInfo'
 * @param  {...any} args
 */
export async function call(path, ...args) {
  const [pkg, struct, fn] = path.split('.');
  const target = window.go?.[pkg]?.[struct]?.[fn];
  if (typeof target !== 'function') {
    throw new Error(`백엔드 함수를 찾을 수 없습니다: ${path}`);
  }
  return target(...args);
}

/** 모듈별 API 묶음 */
export const api = {
  system: {
    getInfo: () => call('system.Service.GetInfo'),
    ping: (msg) => call('system.Service.Ping', msg),
  },
  settings: {
    getAll: () => call('settings.Service.GetAll'),
    get: (key) => call('settings.Service.Get', key),
    set: (key, value) => call('settings.Service.Set', key, String(value)),
  },
};
