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
    navigate: (id) => call('system.Service.Navigate', id),
  },
  settings: {
    getAll: () => call('settings.Service.GetAll'),
    get: (key) => call('settings.Service.Get', key),
    set: (key, value) => call('settings.Service.Set', key, String(value)),
  },
  eventtype: {
    list: (includeHidden = false) => call('eventtype.Service.List', includeHidden),
    create: (name, icon, color) => call('eventtype.Service.Create', name, icon, color),
    update: (id, name, icon, color, isHidden) => call('eventtype.Service.Update', id, name, icon, color, isHidden),
    reorder: (ids) => call('eventtype.Service.Reorder', ids),
    delete: (id) => call('eventtype.Service.Delete', id),
  },
  myevent: {
    listEvents: (eventTypeId = 0) => call('myevent.Service.ListEvents', eventTypeId),
    createEvent: (eventTypeId, title, eventDate, location, targetName, memberSide, notes) =>
      call('myevent.Service.CreateEvent', eventTypeId, title, eventDate, location, targetName, memberSide, notes),
    updateEvent: (id, eventTypeId, title, eventDate, location, targetName, memberSide, notes) =>
      call('myevent.Service.UpdateEvent', id, eventTypeId, title, eventDate, location, targetName, memberSide, notes),
    deleteEvent: (id) => call('myevent.Service.DeleteEvent', id),

    listReceived: (myEventId, search = '') => call('myevent.Service.ListReceived', myEventId, search),
    createReceived: (myEventId, name, phone, relationship, amount, paymentMethod, isThanked, memberSide, notes) =>
      call('myevent.Service.CreateReceived', myEventId, name, phone, relationship, amount, paymentMethod, isThanked, memberSide, notes),
    updateReceived: (id, name, phone, relationship, amount, paymentMethod, isThanked, memberSide, notes) =>
      call('myevent.Service.UpdateReceived', id, name, phone, relationship, amount, paymentMethod, isThanked, memberSide, notes),
    deleteReceived: (id) => call('myevent.Service.DeleteReceived', id),
    toggleThanked: (id) => call('myevent.Service.ToggleThanked', id),
  },
  sent: {
    list: (eventTypeId = 0, search = '') => call('sent.Service.List', eventTypeId, search),
    create: (name, phone, relationship, eventTypeId, eventDate, amount, paymentMethod, attended, memberSide, notes) =>
      call('sent.Service.Create', name, phone, relationship, eventTypeId, eventDate, amount, paymentMethod, attended, memberSide, notes),
    update: (id, name, phone, relationship, eventTypeId, eventDate, amount, paymentMethod, attended, memberSide, notes) =>
      call('sent.Service.Update', id, name, phone, relationship, eventTypeId, eventDate, amount, paymentMethod, attended, memberSide, notes),
    delete: (id) => call('sent.Service.Delete', id),
  },
  matching: {
    listSummaries: (filter = 'all', search = '') => call('matching.Service.ListSummaries', filter, search),
    getPersonDetail: (name, phoneClean = '') => call('matching.Service.GetPersonDetail', name, phoneClean),
    getHintForName: (name, phoneClean = '') => call('matching.Service.GetHintForName', name, phoneClean),
  },
  customfield: {
    listFields: (targetMenu) => call('customfield.Service.ListFields', targetMenu),
    createField: (targetMenu, fieldName, fieldType) => call('customfield.Service.CreateField', targetMenu, fieldName, fieldType),
    deleteField: (id) => call('customfield.Service.DeleteField', id),
    getValuesForRecord: (recordId) => call('customfield.Service.GetValuesForRecord', recordId),
    saveValue: (fieldId, recordId, value) => call('customfield.Service.SaveValue', fieldId, recordId, value),
  },
  dashboard: {
    getSummary: () => call('dashboard.Service.GetSummary'),
  },
  backup: {
    listBackups: () => call('backup.Service.ListBackups'),
    createBackup: (tag = '') => call('backup.Service.CreateBackup', tag),
  },
};
