import { mockData } from './mockData';

/**
 * 백엔드 함수 호출 (Wails 앱 내에서는 Go 함수 직접 호출, 일반 브라우저에서는 Mock 지원)
 * @param {string} path 예) 'system.Service.GetInfo'
 * @param  {...any} args
 */
export async function call(path, ...args) {
  const [pkg, struct, fn] = path.split('.');
  const target = window.go?.[pkg]?.[struct]?.[fn];
  if (typeof target === 'function') {
    return target(...args);
  }

  // 브라우저 개발/미리보기 모드 Mock 응답
  console.info(`[브라우저 미리보기 Mock] ${path}`, args);
  switch (path) {
    case 'settings.Service.get':
      return mockData.settings[args[0]] || '';
    case 'settings.Service.GetAll':
      return mockData.settings;
    case 'eventtype.Service.List':
      return mockData.eventTypes;
    case 'customfield.Service.ListFields':
      return mockData.customFields[args[0]] || [];
    case 'customfield.Service.GetValuesForRecords':
      return mockData.customValues;
    case 'myevent.Service.ListEvents':
      return mockData.myEvents;
    case 'myevent.Service.ListReceived':
      return mockData.received;
    case 'sent.Service.List':
      return mockData.sentList;
    case 'matching.Service.ListSummaries':
      return mockData.matchingSummaries;
    case 'dashboard.Service.GetSummary':
      return {
        totalReceived: 350000,
        totalSent: 150000,
        balance: 200000,
        receivedCount: 3,
        sentCount: 2,
        monthly: [
          { month: '2026-01', received: 0, sent: 0 },
          { month: '2026-02', received: 0, sent: 50000 },
          { month: '2026-03', received: 0, sent: 0 },
          { month: '2026-04', received: 0, sent: 0 },
          { month: '2026-05', received: 350000, sent: 0 },
          { month: '2026-06', received: 0, sent: 0 },
        ],
        typeRatios: [
          { name: '결혼식', amount: 100000, percentage: 67 },
          { name: '장례식', amount: 50000, percentage: 33 },
        ],
      };
    case 'system.Service.GetInfo':
      return {
        appName: '꼬미경조사 (미리보기)',
        version: '0.1.0',
        dbReady: true,
        startedAt: new Date().toISOString(),
      };
    default:
      return null;
  }
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
    getValuesForRecords: (recordIds) => call('customfield.Service.GetValuesForRecords', recordIds),
    saveValue: (fieldId, recordId, value) => call('customfield.Service.SaveValue', fieldId, recordId, value),
    saveValuesForRecord: (recordId, values) => call('customfield.Service.SaveValuesForRecord', recordId, values),
  },
  dashboard: {
    getSummary: () => call('dashboard.Service.GetSummary'),
  },
  backup: {
    listBackups: () => call('backup.Service.ListBackups'),
    createBackup: (tag = '') => call('backup.Service.CreateBackup', tag),
  },
  excelio: {
    exportMyEvent: (myEventId) => call('excelio.Service.ExportMyEvent', myEventId),
    exportSent: (eventTypeId = 0) => call('excelio.Service.ExportSent', eventTypeId),
    downloadTemplate: () => call('excelio.Service.DownloadTemplate'),
    importReceived: (myEventId) => call('excelio.Service.ImportReceived', myEventId),
  },
};
