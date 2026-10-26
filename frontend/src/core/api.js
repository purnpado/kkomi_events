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
    case 'myevent.Service.CreateReceived': {
      const [myEventId, name, phone, relationship, amount, paymentMethod, attendance, isThanked, memberSide, notes] = args;
      const newRec = {
        id: Date.now(),
        myEventId,
        name: (name || '').trim(),
        phone: phone || '',
        phoneClean: (phone || '').replace(/[^0-9]/g, ''),
        relationship: relationship || '지인',
        amount: Number(amount) || 0,
        paymentMethod: paymentMethod || '현금',
        attendance: attendance || 'attended',
        isThanked: !!isThanked,
        memberSide: memberSide || '신랑측',
        notes: notes || '',
        createdAt: new Date().toISOString(),
      };
      mockData.received = [newRec, ...(mockData.received || [])];
      return newRec.id;
    }
    case 'sent.Service.Create': {
      const [name, phone, relationship, eventTypeId, eventDate, amount, paymentMethod, attended, memberSide, notes] = args;
      const typeObj = (mockData.eventTypes || []).find((t) => t.id === eventTypeId);
      const newSent = {
        id: Date.now(),
        name: (name || '').trim(),
        phone: phone || '',
        phoneClean: (phone || '').replace(/[^0-9]/g, ''),
        relationship: relationship || '지인',
        eventTypeId,
        eventTypeName: typeObj?.name || '기타',
        eventTypeIcon: typeObj?.icon || '💌',
        eventDate: eventDate || new Date().toISOString().slice(0, 10),
        amount: Number(amount) || 0,
        paymentMethod: paymentMethod || '계좌이체',
        attended: attended !== false,
        memberSide: memberSide || '본인',
        notes: notes || '',
        createdAt: new Date().toISOString(),
      };
      mockData.sentList = [newSent, ...(mockData.sentList || [])];
      return newSent.id;
    }
    case 'matching.Service.ListSummaries': {
      const filter = args[0] || 'all';
      const search = (args[1] || '').trim().toLowerCase();
      
      // received와 sentList를 동적으로 실시간 매칭 합산
      const map = new Map();
      const getOrCreate = (name, phone, rel) => {
        const cleanName = (name || '').trim();
        const phoneClean = (phone || '').replace(/[^0-9]/g, '');
        let found = null;
        for (const v of map.values()) {
          if (v.name.toLowerCase() === cleanName.toLowerCase()) {
            if (!v.phoneClean || !phoneClean || v.phoneClean === phoneClean) {
              found = v;
              break;
            }
          }
        }
        if (found) {
          if (!found.phone && phone) {
            found.phone = phone;
            found.phoneClean = phoneClean;
          }
          if ((!found.relationship || found.relationship === '지인') && rel) {
            found.relationship = rel;
          }
          return found;
        }
        const item = {
          name: cleanName,
          phone: phone || '',
          phoneClean: phoneClean,
          relationship: rel || '지인',
          receivedCount: 0,
          receivedTotal: 0,
          sentCount: 0,
          sentTotal: 0,
          balance: 0,
          status: 'balanced',
          statusText: '균형 완료',
        };
        map.set(cleanName + '_' + (phoneClean || 'none'), item);
        return item;
      };

      // 1) mockData.received (내 경조사에서 받은 돈)
      for (const r of (mockData.received || [])) {
        if (!r.name) continue;
        const p = getOrCreate(r.name, r.phone, r.relationship);
        p.receivedTotal += Number(r.amount) || 0;
        p.receivedCount += 1;
      }

      // 2) mockData.sentList (타인 경조사에 보낸 돈)
      for (const s of (mockData.sentList || [])) {
        if (!s.name) continue;
        const p = getOrCreate(s.name, s.phone, s.relationship);
        p.sentTotal += Number(s.amount) || 0;
        p.sentCount += 1;
      }

      // 3) mockData.matchingSummaries 에만 있는 초기 데이터도 포함
      for (const m of (mockData.matchingSummaries || [])) {
        if (!m.name) continue;
        const p = getOrCreate(m.name, m.phone, m.relationship);
        if (p.receivedCount === 0 && m.receivedTotal > 0) {
          p.receivedTotal = m.receivedTotal;
          p.receivedCount = m.receivedCount || 1;
        }
        if (p.sentCount === 0 && m.sentTotal > 0) {
          p.sentTotal = m.sentTotal;
          p.sentCount = m.sentCount || 1;
        }
      }

      let list = [];
      for (const p of map.values()) {
        p.balance = p.receivedTotal - p.sentTotal;
        if (p.balance > 0) {
          p.status = 'need_pay';
          p.statusText = '갚을 차례 (받음 > 보냄)';
        } else if (p.balance < 0) {
          p.status = 'receive_back';
          p.statusText = '받을 차례 (보냄 > 받음)';
        } else {
          p.status = 'balanced';
          p.statusText = '균형 완료';
        }

        // 검색어 필터
        if (search) {
          const matchName = p.name.toLowerCase().includes(search);
          const matchPhone = p.phone.includes(search) || p.phoneClean.includes(search);
          const matchRel = (p.relationship || '').toLowerCase().includes(search);
          if (!matchName && !matchPhone && !matchRel) continue;
        }

        // 상태 필터
        if (filter === 'need_pay' && p.balance <= 0) continue;
        if (filter === 'receive_back' && p.balance >= 0) continue;
        if (filter === 'balanced' && p.balance !== 0) continue;

        list.push(p);
      }
      return list;
    }
    case 'matching.Service.GetPersonDetail': {
      const name = (args[0] || '').trim();
      const phoneClean = (args[1] || '').replace(/[^0-9]/g, '');

      // 동적으로 받은 내역 및 보낸 내역 수집
      const recHistory = (mockData.received || [])
        .filter((r) => r.name && r.name.trim().toLowerCase() === name.toLowerCase())
        .map((r) => ({
          id: r.id,
          type: 'received',
          eventDate: r.createdAt ? r.createdAt.slice(0, 10) : '2026-05-16',
          eventTitle: (mockData.myEvents || []).find((e) => e.id === r.myEventId)?.title || '내 경조사',
          amount: Number(r.amount) || 0,
          paymentMethod: r.paymentMethod || '현금',
          notes: r.notes || '',
        }));

      const sentHistory = (mockData.sentList || [])
        .filter((s) => s.name && s.name.trim().toLowerCase() === name.toLowerCase())
        .map((s) => ({
          id: s.id,
          type: 'sent',
          eventDate: s.eventDate || '2026-02-20',
          eventTitle: s.eventTypeName || '타인 경조사',
          amount: Number(s.amount) || 0,
          paymentMethod: s.paymentMethod || '계좌이체',
          notes: s.notes || '',
        }));

      const recTotal = recHistory.reduce((sum, h) => sum + h.amount, 0);
      const sentTotal = sentHistory.reduce((sum, h) => sum + h.amount, 0);
      const balance = recTotal - sentTotal;

      return {
        summary: {
          name,
          phone: phoneClean,
          receivedTotal: recTotal,
          receivedCount: recHistory.length,
          sentTotal: sentTotal,
          sentCount: sentHistory.length,
          balance,
        },
        history: [...recHistory, ...sentHistory].sort((a, b) => (b.eventDate || '').localeCompare(a.eventDate || '')),
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
        currentVersion: '0.1.2',
        latestVersion: 'v0.1.2',
        releaseName: 'V0.1.2',
        releaseBody: '화면 잠금 및 PIN 번호 보안, 자동 업데이트 기능',
        releaseUrl: 'https://github.com/purnpado/kkomi_events/releases',
        downloadUrl: 'https://github.com/purnpado/kkomi_events/releases',
      };
    case 'system.Service.GetInfo':
      return {
        appName: '꼬미경조사 (미리보기)',
        version: '0.1.2',
        dbReady: true,
        startedAt: new Date().toISOString(),
      };
    case 'security.Service.GetStatus': {
      const pin = localStorage.getItem('kkomi_mock_pin') || '';
      const enabled = localStorage.getItem('kkomi_mock_lock_enabled') === 'true';
      const autoLock = parseInt(localStorage.getItem('kkomi_mock_autolock') || '5', 10);
      return {
        isPinSet: !!pin,
        enabled: !!pin && enabled,
        autoLockMinutes: autoLock,
        failCount: 0,
        isLockedOut: false,
        lockoutSeconds: 0,
      };
    }
    case 'security.Service.SetupInitialPin': {
      const pin = args[0] || '';
      if (!/^\d{4}$/.test(pin)) throw new Error('PIN 번호는 4자리 숫자여야 합니다.');
      localStorage.setItem('kkomi_mock_pin', pin);
      localStorage.setItem('kkomi_mock_lock_enabled', 'true');
      localStorage.setItem('kkomi_mock_autolock', '5');
      return true;
    }
    case 'security.Service.VerifyPin': {
      const pin = args[0] || '';
      const savedPin = localStorage.getItem('kkomi_mock_pin') || '';
      if (pin === savedPin) return true;
      throw new Error('PIN 번호가 일치하지 않습니다.');
    }
    case 'security.Service.ChangePin': {
      const [oldPin, newPin] = args;
      const savedPin = localStorage.getItem('kkomi_mock_pin') || '';
      if (oldPin !== savedPin) throw new Error('현재 PIN 번호가 일치하지 않습니다.');
      if (!/^\d{4}$/.test(newPin)) throw new Error('새 PIN 번호는 4자리 숫자여야 합니다.');
      localStorage.setItem('kkomi_mock_pin', newPin);
      return true;
    }
    case 'security.Service.UpdateConfig': {
      const [enabled, autoLockMinutes, currentPin] = args;
      const savedPin = localStorage.getItem('kkomi_mock_pin') || '';
      if (currentPin !== savedPin) throw new Error('현재 PIN 번호가 일치하지 않습니다.');
      localStorage.setItem('kkomi_mock_lock_enabled', String(enabled));
      localStorage.setItem('kkomi_mock_autolock', String(autoLockMinutes));
      return true;
    }
    case 'matching.Service.FindPhoneByName':
      return '010-1234-5678';
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
    findPhoneByName: (name) => call('matching.Service.FindPhoneByName', name),
    syncPhoneForName: (name, phone) => call('matching.Service.SyncPhoneForName', name, phone),
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
    applyUpdate: (downloadUrl) => call('updater.Service.ApplyUpdate', downloadUrl),
    openReleasePage: (url) => call('updater.Service.OpenReleasePage', url),
  },
  security: {
    getStatus: () => call('security.Service.GetStatus'),
    setupInitialPin: (pin) => call('security.Service.SetupInitialPin', pin),
    verifyPin: (pin) => call('security.Service.VerifyPin', pin),
    changePin: (oldPin, newPin) => call('security.Service.ChangePin', oldPin, newPin),
    updateConfig: (enabled, autoLockMinutes, currentPin) =>
      call('security.Service.UpdateConfig', enabled, autoLockMinutes, currentPin),
  },
};

