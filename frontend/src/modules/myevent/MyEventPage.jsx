import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { api } from '../../core/api';
import { emit } from '../../core/eventBus';
import { useBusEvent } from '../../core/hooks';
import { formatMoney, formatPhone, formatDate } from '../../core/format';
import Modal from '../../ui/Modal';
import AmountInput from '../../ui/AmountInput';
import Select from '../../ui/Select';
import EventTypeModal from './EventTypeModal';
import CustomFieldModal from '../../ui/CustomFieldModal';
import { Plus, Search, Settings, Calendar, MapPin, CheckCircle, Trash2, Edit2, UserPlus, Sparkles, SlidersHorizontal, FileSpreadsheet, Upload, Printer, Download, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const RELATION_OPTIONS = [
  { value: '친구', label: '친구' },
  { value: '직장/동료', label: '직장/동료' },
  { value: '친척/가족', label: '친척/가족' },
  { value: '선후배', label: '선후배' },
  { value: '이웃/지인', label: '이웃/지인' },
  { value: '거래처', label: '거래처' },
  { value: '모임/동호회', label: '모임/동호회' },
  { value: '기타', label: '기타' },
];

const ATTENDANCE_OPTIONS = [
  { value: '직접 참석', label: '직접 참석' },
  { value: '불참 (지인 대리 전달)', label: '불참 (지인 대리 전달)' },
  { value: '불참 (계좌 송금)', label: '불참 (계좌 송금)' },
  { value: '불참 (기타)', label: '불참 (기타)' },
];

const PAYMENT_OPTIONS = [
  { value: '현금', label: '현금' },
  { value: '계좌이체', label: '계좌이체' },
  { value: '카카오페이/토스', label: '카카오페이/토스' },
  { value: '화환/선물', label: '화환/선물' },
  { value: '기타', label: '기타' },
];

export default function MyEventPage() {
  const [types, setTypes] = useState([]);
  const [activeTypeId, setActiveTypeId] = useState(null);
  const [events, setEvents] = useState([]);
  const [activeEventId, setActiveEventId] = useState(null);
  const [receivedList, setReceivedList] = useState([]);
  const [search, setSearch] = useState('');

  // 테이블 정렬 상태
  const [sortConfig, setSortConfig] = useState({ key: 'id', order: 'asc' });

  const requestSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { key, order: key === 'amount' ? 'desc' : 'asc' };
    });
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown size={13} style={{ opacity: 0.35 }} />;
    }
    return sortConfig.order === 'asc' ? (
      <ArrowUp size={13} style={{ color: 'var(--primary)', fontWeight: 800 }} />
    ) : (
      <ArrowDown size={13} style={{ color: 'var(--primary)', fontWeight: 800 }} />
    );
  };

  const sortedReceivedList = useMemo(() => {
    if (!receivedList || receivedList.length === 0) return [];
    return [...receivedList].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';

      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal, 'ko');
        return sortConfig.order === 'asc' ? cmp : -cmp;
      }
      if (typeof aVal === 'number' || typeof aVal === 'boolean') {
        return sortConfig.order === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
      }
      return 0;
    });
  }, [receivedList, sortConfig]);

  // 사용자 맞춤 항목 상태
  const [customFields, setCustomFields] = useState([]);
  const [customValues, setCustomValues] = useState({}); // { [recordId]: { [fieldId]: val } }
  const [customFieldModalOpen, setCustomFieldModalOpen] = useState(false);

  // 설정값 (함께 사용 모드 여부)
  const [isSharedMode, setIsSharedMode] = useState(false);

  // 모달 상태들
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [receivedModalOpen, setReceivedModalOpen] = useState(false);

  // 행사 입력 폼
  const [eventForm, setEventForm] = useState({
    id: null,
    title: '',
    eventDate: new Date().toISOString().split('T')[0],
    location: '',
    targetName: '본인',
    memberSide: '신랑측/본인',
    notes: '',
  });

  // 축의/부의금 입력 폼
  const [receivedForm, setReceivedForm] = useState({
    id: null,
    name: '',
    phone: '',
    relationship: '친구',
    amount: 50000,
    paymentMethod: '현금',
    attendance: '직접 참석',
    isThanked: false,
    memberSide: '본인',
    notes: '',
    customValues: {},
  });

  // 1. 탭 목록 불러오기
  const loadTypes = useCallback(async () => {
    try {
      const list = await api.eventtype.list(false);
      setTypes(list || []);
      if (list && list.length > 0 && !activeTypeId) {
        setActiveTypeId(String(list[0].id));
      }
    } catch (err) {
      console.error(err);
    }
  }, [activeTypeId]);

  // 1-1. 맞춤 항목 정의 불러오기
  const loadCustomFields = useCallback(async () => {
    try {
      const fields = await api.customfield.listFields('myevent');
      setCustomFields(fields || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // 2. 행사 목록 불러오기
  const loadEvents = useCallback(async () => {
    if (!activeTypeId) return;
    try {
      const list = await api.myevent.listEvents(Number(activeTypeId));
      setEvents(list || []);
      if (list && list.length > 0) {
        // 기존 선택이 없거나 유효하지 않으면 첫 번째 행사 선택
        if (!activeEventId || !list.some((ev) => ev.id === activeEventId)) {
          setActiveEventId(list[0].id);
        }
      } else {
        setActiveEventId(null);
        setReceivedList([]);
      }
    } catch (err) {
      console.error(err);
    }
  }, [activeTypeId, activeEventId]);

  // 3. 받은 내역 및 해당 맞춤 항목 값 불러오기
  const loadReceived = useCallback(async () => {
    if (!activeEventId) {
      setReceivedList([]);
      setCustomValues({});
      return;
    }
    try {
      const list = await api.myevent.listReceived(activeEventId, search);
      setReceivedList(list || []);

      if (list && list.length > 0) {
        const ids = list.map((item) => item.id);
        const values = await api.customfield.getValuesForRecords(ids);
        setCustomValues(values || {});
      } else {
        setCustomValues({});
      }
    } catch (err) {
      console.error(err);
    }
  }, [activeEventId, search]);

  useEffect(() => {
    loadTypes();
    loadCustomFields();
    api.settings.get('usage_mode').then((val) => {
      setIsSharedMode(val === 'shared');
    });
  }, [loadTypes, loadCustomFields]);

  useEffect(() => {
    loadEvents();
  }, [activeTypeId, loadEvents]);

  useEffect(() => {
    loadReceived();
  }, [activeEventId, search, loadReceived]);

  // 이벤트 버스 구독 -> 백엔드 또는 다른 모듈에서 변경 시 자동 새로고침
  useBusEvent(['eventtype.*', 'settings.changed'], () => {
    loadTypes();
    api.settings.get('usage_mode').then((val) => setIsSharedMode(val === 'shared'));
  });
  useBusEvent('myevent.*', () => {
    loadEvents();
  });
  useBusEvent('received.*', () => {
    loadReceived();
    loadEvents(); // 합계 갱신
  });
  useBusEvent('customfield.*', () => {
    loadCustomFields();
    loadReceived();
  });

  const activeEvent = events.find((e) => e.id === activeEventId);
  const activeType = types.find((t) => String(t.id) === String(activeTypeId));

  // ── 행사 등록 / 수정 ──
  const openCreateEvent = () => {
    setEventForm({
      id: null,
      title: `${activeType ? activeType.name : '경조사'} 행사`,
      eventDate: new Date().toISOString().split('T')[0],
      location: '',
      targetName: '본인',
      memberSide: '신랑측/본인',
      notes: '',
    });
    setEventModalOpen(true);
  };

  const openEditEvent = (ev) => {
    setEventForm({
      id: ev.id,
      title: ev.title,
      eventDate: ev.eventDate,
      location: ev.location,
      targetName: ev.targetName,
      memberSide: ev.memberSide,
      notes: ev.notes,
    });
    setEventModalOpen(true);
  };

  const handleSaveEvent = async () => {
    if (!eventForm.title.trim()) {
      emit('toast.show', { title: '입력 필요', message: '행사 제목을 입력해주세요.', type: 'error' });
      return;
    }
    try {
      if (eventForm.id) {
        await api.myevent.updateEvent(
          eventForm.id,
          Number(activeTypeId),
          eventForm.title,
          eventForm.eventDate,
          eventForm.location,
          eventForm.targetName,
          eventForm.memberSide,
          eventForm.notes
        );
        emit('toast.show', { title: '행사 수정', message: '행사 정보가 수정되었습니다.', type: 'success' });
      } else {
        const created = await api.myevent.createEvent(
          Number(activeTypeId),
          eventForm.title,
          eventForm.eventDate,
          eventForm.location,
          eventForm.targetName,
          eventForm.memberSide,
          eventForm.notes
        );
        setActiveEventId(created.id);
        emit('toast.show', { title: '행사 생성', message: `'${eventForm.title}' 행사가 등록되었습니다.`, type: 'success' });
      }
      setEventModalOpen(false);
      loadEvents();
    } catch (err) {
      emit('toast.show', { title: '저장 실패', message: String(err), type: 'error' });
    }
  };

  const handleDeleteEvent = async (id, title) => {
    if (!window.confirm(`'${title}' 행사와 포함된 모든 받은 내역을 휴지통으로 이동하시겠습니까?`)) return;
    try {
      await api.myevent.deleteEvent(id);
      emit('toast.show', { title: '행사 삭제', message: '행사가 휴지통으로 이동되었습니다.', type: 'success' });
      loadEvents();
    } catch (err) {
      emit('toast.show', { title: '삭제 실패', message: String(err), type: 'error' });
    }
  };

  // ── 축의·부의금 등록 / 수정 ──
  const openCreateReceived = () => {
    if (!activeEventId) {
      emit('toast.show', { title: '행사 필요', message: '먼저 행사를 등록하거나 선택해주세요.', type: 'error' });
      return;
    }
    setReceivedForm({
      id: null,
      name: '',
      phone: '',
      relationship: '친구',
      amount: 50000,
      paymentMethod: '현금',
      attendance: '직접 참석',
      isThanked: false,
      memberSide: '신랑측/본인',
      notes: '',
      customValues: {},
    });
    setReceivedModalOpen(true);
  };

  const openEditReceived = (item) => {
    setReceivedForm({
      id: item.id,
      name: item.name,
      phone: item.phone,
      relationship: item.relationship,
      amount: item.amount,
      paymentMethod: item.paymentMethod || '현금',
      attendance: item.attendance || '직접 참석',
      isThanked: item.isThanked,
      memberSide: item.memberSide,
      notes: item.notes,
      customValues: { ...(customValues[item.id] || {}) },
    });
    setReceivedModalOpen(true);
  };

  const handleSaveReceived = async () => {
    if (!receivedForm.name.trim()) {
      emit('toast.show', { title: '입력 필요', message: '이름을 입력해주세요.', type: 'error' });
      return;
    }
    try {
      let savedId = receivedForm.id;
      if (receivedForm.id) {
        await api.myevent.updateReceived(
          receivedForm.id,
          receivedForm.name.trim(),
          receivedForm.phone,
          receivedForm.relationship,
          receivedForm.amount,
          receivedForm.paymentMethod,
          receivedForm.attendance,
          receivedForm.isThanked,
          receivedForm.memberSide,
          receivedForm.notes
        );
        emit('toast.show', { title: '수정 완료', message: '축의·부의금 내역이 수정되었습니다.', type: 'success' });
      } else {
        const res = await api.myevent.createReceived(
          activeEventId,
          receivedForm.name.trim(),
          receivedForm.phone,
          receivedForm.relationship,
          receivedForm.amount,
          receivedForm.paymentMethod,
          receivedForm.attendance,
          receivedForm.isThanked,
          receivedForm.memberSide,
          receivedForm.notes
        );
        savedId = res?.id;
        emit('toast.show', { title: '등록 완료', message: `${receivedForm.name} 님의 축의·부의금이 기록되었습니다.`, type: 'success' });
      }

      // 맞춤 항목 값 저장
      if (savedId && receivedForm.customValues && Object.keys(receivedForm.customValues).length > 0) {
        // fieldId를 숫자로 변환하여 저장
        const valsToSave = {};
        for (const [k, v] of Object.entries(receivedForm.customValues)) {
          valsToSave[Number(k)] = String(v);
        }
        await api.customfield.saveValuesForRecord(savedId, valsToSave);
      }

      setReceivedModalOpen(false);
      loadReceived();
      loadEvents();
    } catch (err) {
      emit('toast.show', { title: '저장 실패', message: String(err), type: 'error' });
    }
  };

  const handleDeleteReceived = async (id, name) => {
    if (!window.confirm(`${name} 님의 내역을 삭제하시겠습니까?`)) return;
    try {
      await api.myevent.deleteReceived(id);
      emit('toast.show', { title: '삭제 완료', message: '내역이 휴지통으로 이동되었습니다.', type: 'success' });
      loadReceived();
      loadEvents();
    } catch (err) {
      emit('toast.show', { title: '삭제 실패', message: String(err), type: 'error' });
    }
  };

  const handleToggleThanked = async (id) => {
    try {
      await api.myevent.toggleThanked(id);
      loadReceived();
    } catch (err) {
      console.error(err);
    }
  };

  // ── 엑셀 내보내기 / 가져오기 / 인쇄 ──
  const handleExportExcel = async () => {
    if (!activeEventId) {
      emit('toast.show', { title: '행사 필요', message: '먼저 행사를 선택해주세요.', type: 'error' });
      return;
    }
    try {
      const savedPath = await api.excelio.exportMyEvent(activeEventId);
      if (savedPath) {
        emit('toast.show', {
          title: '엑셀 내보내기 완료',
          message: `파일이 성공적으로 저장되었습니다:\n${savedPath}`,
          type: 'success',
        });
      }
    } catch (err) {
      emit('toast.show', { title: '내보내기 실패', message: String(err), type: 'error' });
    }
  };

  const handleImportExcel = async () => {
    if (!activeEventId) {
      emit('toast.show', { title: '행사 필요', message: '먼저 행사를 선택해주세요.', type: 'error' });
      return;
    }
    try {
      const res = await api.excelio.importReceived(activeEventId);
      if (res) {
        emit('toast.show', {
          title: '가져오기 완료',
          message: `총 ${res.totalRows}행 중 ${res.successRows}건이 등록되었습니다.`,
          type: 'success',
        });
        if (res.errors && res.errors.length > 0) {
          alert('일부 행을 가져오지 못했습니다:\n' + res.errors.slice(0, 5).join('\n'));
        }
        loadReceived();
        loadEvents();
      }
    } catch (err) {
      emit('toast.show', { title: '가져오기 실패', message: String(err), type: 'error' });
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const savedPath = await api.excelio.downloadTemplate();
      if (savedPath) {
        emit('toast.show', {
          title: '양식 다운로드 완료',
          message: `가져오기 양식이 저장되었습니다:\n${savedPath}`,
          type: 'success',
        });
      }
    } catch (err) {
      emit('toast.show', { title: '다운로드 실패', message: String(err), type: 'error' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-container">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">나의 경조사</h1>
          <p className="page-desc">결혼, 돌잔치, 장례식 등 내가 주최한 행사에 들어온 축의금·부의금을 정리합니다.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setCustomFieldModalOpen(true)}
            title="원하는 맞춤 항목(식권 매수, 방명록 번호 등) 자유롭게 추가"
          >
            <SlidersHorizontal size={16} /> 맞춤 항목 관리
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setTypeModalOpen(true)}
            title="탭 종류 추가 및 순서 변경"
          >
            <Settings size={16} /> 탭 목록 관리
          </button>
        </div>
      </header>

      {/* 1차 탭: 경조사 대분류 (결혼, 돌잔치, 장례식 등) */}
      <Tabs.Root value={activeTypeId || ''} onValueChange={(val) => setActiveTypeId(val)}>
        <div className="tabs-header-bar">
          <Tabs.List className="tabs-list">
            {types.map((t) => (
              <Tabs.Trigger key={t.id} value={String(t.id)} className="tab-trigger">
                <span>{t.icon}</span>
                <span>{t.name}</span>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </div>
      </Tabs.Root>

      {/* 2차 서브 탭: 선택된 분류의 행사들을 가로 탭으로 나열 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--fg-muted)' }}>
            📅 {activeType?.name || '경조사'} 행사 선택
          </span>
        </div>

        <div className="subtabs-container">
          {events.length > 0 ? (
            events.map((ev) => {
              const isSelected = ev.id === activeEventId;
              return (
                <button
                  key={ev.id}
                  type="button"
                  className="subtab-item"
                  data-active={isSelected}
                  onClick={() => setActiveEventId(ev.id)}
                >
                  <span>{activeType?.icon || '🎉'}</span>
                  <span>{ev.title}</span>
                  <span style={{ fontSize: '0.78rem', opacity: isSelected ? 0.9 : 0.65, marginLeft: 2 }}>
                    ({formatDate(ev.eventDate)})
                  </span>
                </button>
              );
            })
          ) : (
            <span style={{ color: 'var(--fg-muted)', fontSize: '0.88rem', padding: '6px 0' }}>
              등록된 {activeType?.name || '행사'}가 없습니다.
            </span>
          )}
          <button type="button" className="subtab-add-btn" onClick={openCreateEvent}>
            <Plus size={15} /> 새 행사 추가
          </button>
        </div>
      </div>

      {/* 선택된 행사 상세 정보 카드 */}
      {activeEvent && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: 'var(--fg-muted)', fontSize: '0.9rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, color: 'var(--fg)' }}>
                <Calendar size={16} /> {formatDate(activeEvent.eventDate)}
              </span>
              {activeEvent.location && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={15} /> {activeEvent.location}
                </span>
              )}
              {activeEvent.targetName && <span>주인공: <strong style={{ color: 'var(--fg)' }}>{activeEvent.targetName}</strong></span>}
              {activeEvent.notes && <span>비고: {activeEvent.notes}</span>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn-chip" onClick={() => openEditEvent(activeEvent)}>
                  <Edit2 size={13} /> 행사 정보 수정
                </button>
                <button
                  type="button"
                  className="btn-chip btn-chip-clear"
                  onClick={() => handleDeleteEvent(activeEvent.id, activeEvent.title)}
                >
                  <Trash2 size={13} /> 삭제
                </button>
              </div>

              <div style={{ height: 24, width: 1, background: 'var(--border)' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div>
                  <span className="stat-label">총 인원: </span>
                  <strong style={{ fontSize: '1.2rem', color: 'var(--fg)' }}>{activeEvent.totalCount}명</strong>
                </div>
                <div>
                  <span className="stat-label">총 금액: </span>
                  <strong style={{ fontSize: '1.35rem', color: 'var(--income)' }}>{formatMoney(activeEvent.totalAmount)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 축의·부의금 명단 목록 섹션 */}
      {activeEvent ? (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 260 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--fg-muted)' }} />
              <input
                type="text"
                className="input-text"
                placeholder="이름, 전화번호, 비고 검색..."
                style={{ paddingLeft: 36 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-chip"
                onClick={handleDownloadTemplate}
                title="엑셀 대량 등록용 표준 양식 파일 다운로드"
              >
                <Download size={14} /> 양식 다운로드
              </button>
              <button
                type="button"
                className="btn-chip"
                onClick={handleImportExcel}
                title="기존 엑셀 장부 파일(.xlsx)에서 대량으로 가져오기"
              >
                <Upload size={14} /> 엑셀 가져오기
              </button>
              <button
                type="button"
                className="btn-chip"
                onClick={handleExportExcel}
                title="현재 받은 내역 장부를 서식 있는 엑셀 파일로 저장"
              >
                <FileSpreadsheet size={14} /> 엑셀 내보내기
              </button>
              <button
                type="button"
                className="btn-chip"
                onClick={handlePrint}
                title="장부 인쇄 또는 PDF 파일로 저장"
              >
                <Printer size={14} /> 인쇄/PDF
              </button>
              <button type="button" className="btn" onClick={openCreateReceived} style={{ marginLeft: 4 }}>
                <UserPlus size={16} /> 축의·부의금 등록
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => requestSort('name')} style={{ width: 110, cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      이름 {renderSortIcon('name')}
                    </div>
                  </th>
                  <th style={{ width: 130 }}>전화번호</th>
                  <th onClick={() => requestSort('relationship')} style={{ width: 100, cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      관계 {renderSortIcon('relationship')}
                    </div>
                  </th>
                  <th onClick={() => requestSort('amount')} style={{ width: 130, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      금액 {renderSortIcon('amount')}
                    </div>
                  </th>
                  <th onClick={() => requestSort('attendance')} style={{ width: 130, textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      참석 여부 {renderSortIcon('attendance')}
                    </div>
                  </th>
                  {isSharedMode && <th style={{ width: 100 }}>구분</th>}
                  <th onClick={() => requestSort('thanked')} style={{ width: 90, textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      답례 완료 {renderSortIcon('thanked')}
                    </div>
                  </th>
                  {customFields.map((f) => (
                    <th key={f.id} style={{ minWidth: 90 }}>
                      {f.fieldName}
                    </th>
                  ))}
                  <th>비고</th>
                  <th style={{ width: 100, textAlign: 'center' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {sortedReceivedList.length === 0 ? (
                  <tr>
                    <td colSpan={(isSharedMode ? 9 : 8) + customFields.length} className="table-empty">
                      <Sparkles size={32} style={{ color: 'var(--brand-400)', opacity: 0.8 }} />
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--fg)' }}>
                        {search ? '검색된 축의·부의금 내역이 없습니다.' : '아직 등록된 축의·부의금이 없습니다.'}
                      </div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--fg-muted)' }}>
                        우측 상단의 <strong>[+ 축의·부의금 등록]</strong> 버튼을 눌러 첫 손님을 기록해 보세요.
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedReceivedList.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 700 }}>{item.name}</td>
                      <td className="mono">{formatPhone(item.phone)}</td>
                      <td>
                        <span className="badge">{item.relationship}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--income)' }}>
                        {formatMoney(item.amount)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`badge ${
                            item.attendance === '직접 참석'
                              ? 'badge-att-direct'
                              : item.attendance?.includes('송금')
                              ? 'badge-att-transfer'
                              : item.attendance?.includes('전달')
                              ? 'badge-att-proxy'
                              : ''
                          }`}
                        >
                          {item.attendance || '직접 참석'}
                        </span>
                      </td>
                      {isSharedMode && <td><span className="badge">{item.memberSide || '공통'}</span></td>}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className={`btn-chip ${item.isThanked ? 'badge-ok' : ''}`}
                          onClick={() => handleToggleThanked(item.id)}
                          title="답례 여부 변경"
                        >
                          {item.isThanked ? '완료' : '미답례'}
                        </button>
                      </td>
                      {customFields.map((f) => {
                        const val = customValues[item.id]?.[f.id] || '';
                        return (
                          <td key={f.id}>
                            {f.fieldType === 'checkbox' ? (
                              <span className={`badge ${val === 'true' || val === '1' ? 'badge-ok' : ''}`}>
                                {val === 'true' || val === '1' ? '예' : '아니오'}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.88rem' }}>{val || '-'}</span>
                            )}
                          </td>
                        );
                      })}
                      <td style={{ color: 'var(--fg-muted)', fontSize: '0.85rem' }}>{item.notes || '-'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                          <button
                            type="button"
                            className="btn-chip"
                            onClick={() => openEditReceived(item)}
                            title="수정"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn-chip btn-chip-clear"
                            onClick={() => handleDeleteReceived(item.id, item.name)}
                            title="삭제"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Sparkles size={36} style={{ color: 'var(--brand-500)', marginBottom: 12 }} />
          <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem' }}>행사를 먼저 등록해주세요</h3>
          <p className="page-desc" style={{ marginBottom: 16 }}>
            {activeType ? activeType.name : '경조사'} 행사를 생성하면 참석자 명단과 축의금/부의금을 기록할 수 있습니다.
          </p>
          <button type="button" className="btn" onClick={openCreateEvent}>
            <Plus size={16} /> '{activeType ? activeType.name : '경조사'}' 행사 추가하기
          </button>
        </div>
      )}

      {/* 탭 관리 모달 */}
      <EventTypeModal
        open={typeModalOpen}
        onOpenChange={setTypeModalOpen}
        eventTypes={types}
        onRefresh={loadTypes}
      />

      {/* 행사 등록/수정 모달 */}
      <Modal
        open={eventModalOpen}
        onOpenChange={setEventModalOpen}
        title={eventForm.id ? '행사 정보 수정' : '새 행사 만들기'}
        description={`'${activeType ? activeType.name : ''}' 종류의 행사를 등록합니다.`}
      >
        <div className="form-group">
          <label className="form-label">행사 제목 *</label>
          <input
            type="text"
            className="input-text"
            placeholder="예: 우리 결혼식, 첫째 돌잔치, 부친상 등"
            value={eventForm.title}
            onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
            autoFocus
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">행사 날짜 *</label>
            <input
              type="date"
              className="input-text"
              value={eventForm.eventDate}
              onChange={(e) => setEventForm({ ...eventForm, eventDate: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">주인공</label>
            <input
              type="text"
              className="input-text"
              placeholder="예: 본인, 자녀, 부모님"
              value={eventForm.targetName}
              onChange={(e) => setEventForm({ ...eventForm, targetName: e.target.value })}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">장소</label>
          <input
            type="text"
            className="input-text"
            placeholder="예: 더채플앳논현 3층, 서울대병원 장례식장 1호실 등"
            value={eventForm.location}
            onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
          />
        </div>
        {isSharedMode && (
          <div className="form-group">
            <label className="form-label">담당 구분 (함께 사용)</label>
            <input
              type="text"
              className="input-text"
              placeholder="예: 신랑측, 신부측, 공동"
              value={eventForm.memberSide}
              onChange={(e) => setEventForm({ ...eventForm, memberSide: e.target.value })}
            />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">비고</label>
          <textarea
            className="input-text"
            placeholder="메모할 사항을 입력하세요."
            value={eventForm.notes}
            onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={() => setEventModalOpen(false)}>
            취소
          </button>
          <button type="button" className="btn" onClick={handleSaveEvent}>
            저장
          </button>
        </div>
      </Modal>

      {/* 축의·부의금 등록/수정 모달 */}
      <Modal
        open={receivedModalOpen}
        onOpenChange={setReceivedModalOpen}
        title={receivedForm.id ? '축의·부의금 정보 수정' : '새 축의·부의금 등록'}
        description={`'${activeEvent ? activeEvent.title : ''}' 행사에 축하/조의를 보내주신 분의 정보를 기록합니다.`}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">축의·부의자(손님) 이름 *</label>
            <input
              type="text"
              className="input-text"
              placeholder="이름 입력"
              value={receivedForm.name}
              onChange={(e) => setReceivedForm({ ...receivedForm, name: e.target.value })}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">전화번호</label>
            <input
              type="text"
              className="input-text"
              placeholder="010-0000-0000"
              value={receivedForm.phone}
              onChange={(e) => setReceivedForm({ ...receivedForm, phone: e.target.value })}
            />
          </div>
        </div>

        {/* 금액 전용 입력기 컴포넌트! */}
        <div className="form-group">
          <label className="form-label">금액 *</label>
          <AmountInput
            value={receivedForm.amount}
            onChange={(val) => setReceivedForm({ ...receivedForm, amount: val })}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">관계</label>
            <Select
              value={receivedForm.relationship}
              onValueChange={(val) => setReceivedForm({ ...receivedForm, relationship: val })}
              options={RELATION_OPTIONS}
            />
          </div>
          <div className="form-group">
            <label className="form-label">참석 여부 *</label>
            <Select
              value={receivedForm.attendance}
              onValueChange={(val) => setReceivedForm({ ...receivedForm, attendance: val })}
              options={ATTENDANCE_OPTIONS}
            />
          </div>
        </div>

        {isSharedMode && (
          <div className="form-group">
            <label className="form-label">손님 구분 (함께 사용)</label>
            <input
              type="text"
              className="input-text"
              placeholder="예: 신랑측, 신부측, 공동"
              value={receivedForm.memberSide}
              onChange={(e) => setReceivedForm({ ...receivedForm, memberSide: e.target.value })}
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={receivedForm.isThanked}
              onChange={(e) => setReceivedForm({ ...receivedForm, isThanked: e.target.checked })}
              style={{ width: 18, height: 18 }}
            />
            <span>감사 인사/답례품 전달 완료</span>
          </label>
        </div>

        {/* 사용자 맞춤 추가 항목 폼 필드 */}
        {customFields.length > 0 && (
          <div
            style={{
              padding: '12px 14px',
              background: 'var(--bg-sunken)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'var(--brand-700)',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <SlidersHorizontal size={14} /> 맞춤 추가 항목
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              {customFields.map((f) => (
                <div key={f.id} className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem' }}>
                    {f.fieldName}
                  </label>
                  {f.fieldType === 'checkbox' ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={receivedForm.customValues?.[f.id] === 'true' || receivedForm.customValues?.[f.id] === '1'}
                        onChange={(e) =>
                          setReceivedForm({
                            ...receivedForm,
                            customValues: {
                              ...receivedForm.customValues,
                              [f.id]: e.target.checked ? 'true' : 'false',
                            },
                          })
                        }
                        style={{ width: 18, height: 18 }}
                      />
                      <span style={{ fontSize: '0.88rem' }}>체크 (예)</span>
                    </label>
                  ) : f.fieldType === 'number' ? (
                    <input
                      type="number"
                      className="input-text"
                      placeholder={`${f.fieldName} 입력`}
                      value={receivedForm.customValues?.[f.id] || ''}
                      onChange={(e) =>
                        setReceivedForm({
                          ...receivedForm,
                          customValues: {
                            ...receivedForm.customValues,
                            [f.id]: e.target.value,
                          },
                        })
                      }
                    />
                  ) : f.fieldType === 'date' ? (
                    <input
                      type="date"
                      className="input-text"
                      value={receivedForm.customValues?.[f.id] || ''}
                      onChange={(e) =>
                        setReceivedForm({
                          ...receivedForm,
                          customValues: {
                            ...receivedForm.customValues,
                            [f.id]: e.target.value,
                          },
                        })
                      }
                    />
                  ) : (
                    <input
                      type="text"
                      className="input-text"
                      placeholder={`${f.fieldName} 입력`}
                      value={receivedForm.customValues?.[f.id] || ''}
                      onChange={(e) =>
                        setReceivedForm({
                          ...receivedForm,
                          customValues: {
                            ...receivedForm.customValues,
                            [f.id]: e.target.value,
                          },
                        })
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">비고</label>
          <input
            type="text"
            className="input-text"
            placeholder="특이사항, 방명록 번호, 동행인 등 메모"
            value={receivedForm.notes}
            onChange={(e) => setReceivedForm({ ...receivedForm, notes: e.target.value })}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={() => setReceivedModalOpen(false)}>
            취소
          </button>
          <button type="button" className="btn" onClick={handleSaveReceived}>
            저장
          </button>
        </div>
      </Modal>

      {/* 맞춤 항목 관리 모달 */}
      <CustomFieldModal
        open={customFieldModalOpen}
        onOpenChange={setCustomFieldModalOpen}
        targetMenu="myevent"
        targetTitle="나의 경조사"
      />
    </div>
  );
}
