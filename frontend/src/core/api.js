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
    case 'sent.Service.List': {
      const typeId = args[0] || 0;
      const search = (args[1] || '').trim().toLowerCase();
      let list = mockData.sentList || [];
      if (typeId > 0) {
        list = list.filter((item) => item.eventTypeId === typeId);
      }
      if (search) {
        list = list.filter((item) => (item.name && item.name.toLowerCase().includes(search)) || (item.notes && item.notes.toLowerCase().includes(search)));
      }
      return list;
    }
    case 'matching.Service.ListSummaries': {
      const filter = args[0] || 'all';
      const search = (args[1] || '').trim().toLowerCase();
      let list = mockData.matchingSummaries || [];
      if (filter === 'need_pay') list = list.filter((s) => s.balance > 0);
      if (filter === 'receive_back') list = list.filter((s) => s.balance < 0);
      if (filter === 'balanced') list = list.filter((s) => s.balance === 0);
      if (search) list = list.filter((s) => s.name.toLowerCase().includes(search));
      return list;
    }
    case 'matching.Service.GetPersonDetail': {
      const name = args[0] || '';
      const target = (mockData.matchingSummaries || []).find((s) => s.name === name) || {
        name,
        receivedTotal: 100000,
        sentTotal: 50000,
        balance: 50000,
      };
      return {
        summary: {
          name: target.name,
          receivedTotal: target.receivedTotal,
          receivedCount: target.receivedTotal > 0 ? 1 : 0,
          sentTotal: target.sentTotal,
          sentCount: target.sentTotal > 0 ? 1 : 0,
          balance: target.balance,
        },
        history: [
          ...(target.receivedTotal > 0 ? [{ id: 1, type: 'received', eventDate: '2026-05-16', eventTitle: '우리 결혼식', amount: target.receivedTotal, notes: '직접 참석' }] : []),
          ...(target.sentTotal > 0 ? [{ id: 2, type: 'sent', eventDate: '2026-02-20', eventTitle: '부친상 조의', amount: target.sentTotal, notes: '현금/봉투' }] : []),
        ],
      };
    }
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
    case 'calendar.Service.GetConfig':
      return {
        mode: mockData.settings.calendar_mode || 'none',
        icalUrl: mockData.settings.calendar_ical_url || '',
        apiKey: mockData.settings.calendar_api_key || '',
        calendarId: mockData.settings.calendar_id || 'primary',
        lastSyncAt: mockData.settings.calendar_last_sync_at || '',
        lastSyncMsg: mockData.settings.calendar_last_sync_msg || '',
        syncCount: 2,
      };
    case 'calendar.Service.SaveConfig':
      mockData.settings.calendar_mode = args[0];
      mockData.settings.calendar_ical_url = args[1];
      mockData.settings.calendar_api_key = args[2];
      mockData.settings.calendar_id = args[3];
      return true;
    case 'calendar.Service.TestAndSync': {
      const mode = args[0];
      mockData.settings.calendar_mode = mode;
      mockData.settings.calendar_ical_url = args[1];
      mockData.settings.calendar_api_key = args[2];
      mockData.settings.calendar_id = args[3];
      const nowStr = new Date().toLocaleString('ko-KR');
      mockData.settings.calendar_last_sync_at = nowStr;
      mockData.settings.calendar_last_sync_msg = '성공: 구글 캘린더에서 경조사 관련 일정 2건을 가져왔습니다.';
      return {
        mode,
        icalUrl: args[1],
        apiKey: args[2],
        calendarId: args[3],
        lastSyncAt: nowStr,
        lastSyncMsg: mockData.settings.calendar_last_sync_msg,
        syncCount: 2,
      };
    }
    case 'calendar.Service.SyncNow': {
      const nowStr = new Date().toLocaleString('ko-KR');
      mockData.settings.calendar_last_sync_at = nowStr;
      mockData.settings.calendar_last_sync_msg = '성공: 구글 캘린더에서 경조사 관련 일정 2건을 가져왔습니다.';
      return {
        mode: mockData.settings.calendar_mode || 'ical',
        icalUrl: mockData.settings.calendar_ical_url || '',
        apiKey: mockData.settings.calendar_api_key || '',
        calendarId: mockData.settings.calendar_id || 'primary',
        lastSyncAt: nowStr,
        lastSyncMsg: mockData.settings.calendar_last_sync_msg,
        syncCount: 2,
      };
    }
    case 'trash.Service.List':
      return [
        { id: 1, itemType: 'sent', typeLabel: '보낸 돈 (타인 경조사)', title: '테스트 지인', subtitle: '[결혼] 친구', eventDate: '2026-04-10', amount: 100000, deletedAt: '2026-10-23 20:00:00' },
      ];
    case 'trash.Service.GetCount':
      return 1;
    case 'trash.Service.Restore':
    case 'trash.Service.RestoreAll':
    case 'trash.Service.Purge':
    case 'trash.Service.PurgeAll':
      return true;
    case 'calendar.Service.OpenURL':
    case 'system.Service.OpenURL':
    case 'updater.Service.OpenReleasePage':
      window.open(args[0] || 'https://github.com/purnpado/kkomi_events/releases', '_blank');
      return true;
    case 'updater.Service.CheckUpdate':
      return {
        hasUpdate: false,
        currentVersion: '0.1.1',
        latestVersion: 'v0.1.1',
        releaseName: 'V0.1.1',
        releaseBody: '자동 업데이트 및 GitHub 릴리즈 이중화',
        releaseUrl: 'https://github.com/purnpado/kkomi_events/releases',
        downloadUrl: 'https://github.com/purnpado/kkomi_events/releases',
      };
    case 'system.Service.GetInfo':
      return {
        appName: '꼬미경조사 (미리보기)',
        version: '0.1.1',
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
    openUrl: (url) => call('system.Service.OpenURL', url),
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
    createReceived: (myEventId, name, phone, relationship, amount, paymentMethod, attendance, isThanked, memberSide, notes) =>
      call('myevent.Service.CreateReceived', myEventId, name, phone, relationship, amount, paymentMethod, attendance, isThanked, memberSide, notes),
    updateReceived: (id, name, phone, relationship, amount, paymentMethod, attendance, isThanked, memberSide, notes) =>
      call('myevent.Service.UpdateReceived', id, name, phone, relationship, amount, paymentMethod, attendance, isThanked, memberSide, notes),
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
  calendar: {
    getConfig: () => call('calendar.Service.GetConfig'),
    saveConfig: (mode, icalUrl, apiKey, calendarId) => call('calendar.Service.SaveConfig', mode, icalUrl, apiKey, calendarId),
    testAndSync: (mode, icalUrl, apiKey, calendarId) => call('calendar.Service.TestAndSync', mode, icalUrl, apiKey, calendarId),
    syncNow: () => call('calendar.Service.SyncNow'),
    openUrl: (url) => call('calendar.Service.OpenURL', url),
  },
  trash: {
    list: () => call('trash.Service.List'),
    getCount: () => call('trash.Service.GetCount'),
    restore: (itemType, id) => call('trash.Service.Restore', itemType, id),
    restoreAll: () => call('trash.Service.RestoreAll'),
    purge: (itemType, id) => call('trash.Service.Purge', itemType, id),
    purgeAll: () => call('trash.Service.PurgeAll'),
  },
  updater: {
    checkUpdate: () => call('updater.Service.CheckUpdate'),
    openReleasePage: (url) => call('updater.Service.OpenReleasePage', url),
  },
};
