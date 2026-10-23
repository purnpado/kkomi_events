import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../core/api';
import { emit } from '../../core/eventBus';
import { useBusEvent } from '../../core/hooks';
import { formatMoney, formatPhone, formatDate } from '../../core/format';
import Modal from '../../ui/Modal';
import AmountInput from '../../ui/AmountInput';
import Select from '../../ui/Select';
import { Plus, Search, Calendar, Trash2, Edit2, Send, Lightbulb, CheckCircle2 } from 'lucide-react';

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

const PAYMENT_OPTIONS = [
  { value: '계좌이체', label: '계좌이체' },
  { value: '현금/봉투', label: '현금/봉투' },
  { value: '카카오페이/토스', label: '카카오페이/토스' },
  { value: '화환/선물', label: '화환/선물' },
  { value: '기타', label: '기타' },
];

export default function SentPage() {
  const [types, setTypes] = useState([]);
  const [selectedTypeId, setSelectedTypeId] = useState(0); // 0이면 전체
  const [sentList, setSentList] = useState([]);
  const [search, setSearch] = useState('');
  const [isSharedMode, setIsSharedMode] = useState(false);

  // 모달 상태
  const [modalOpen, setModalOpen] = useState(false);
  const [hintMessage, setHintMessage] = useState('');

  // 폼 상태
  const [form, setForm] = useState({
    id: null,
    name: '',
    phone: '',
    relationship: '친구',
    eventTypeId: 1,
    eventDate: new Date().toISOString().split('T')[0],
    amount: 50000,
    paymentMethod: '계좌이체',
    attended: true,
    memberSide: '본인',
    notes: '',
  });

  const loadTypes = useCallback(async () => {
    try {
      const list = await api.eventtype.list(false);
      setTypes(list || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadSent = useCallback(async () => {
    try {
      const list = await api.sent.list(selectedTypeId, search);
      setSentList(list || []);
    } catch (err) {
      console.error(err);
    }
  }, [selectedTypeId, search]);

  useEffect(() => {
    loadTypes();
    api.settings.get('usage_mode').then((val) => setIsSharedMode(val === 'shared'));
  }, [loadTypes]);

  useEffect(() => {
    loadSent();
  }, [loadSent]);

  useBusEvent(['sent.*', 'eventtype.*', 'received.*'], () => {
    loadSent();
  });

  // 상대방 이름 입력 시 내 경조사에 냈던 기록 자동 조회 (매칭 힌트!)
  const handleNameChange = async (newName) => {
    setForm((prev) => ({ ...prev, name: newName }));
    if (newName.trim().length >= 2) {
      try {
        const hint = await api.matching.getHintForName(newName.trim());
        setHintMessage(hint || '');
      } catch {
        setHintMessage('');
      }
    } else {
      setHintMessage('');
    }
  };

  const openCreate = () => {
    setHintMessage('');
    setForm({
      id: null,
      name: '',
      phone: '',
      relationship: '친구',
      eventTypeId: types[0]?.id || 1,
      eventDate: new Date().toISOString().split('T')[0],
      amount: 50000,
      paymentMethod: '계좌이체',
      attended: true,
      memberSide: '본인',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEdit = async (item) => {
    setHintMessage('');
    setForm({
      id: item.id,
      name: item.name,
      phone: item.phone,
      relationship: item.relationship,
      eventTypeId: item.eventTypeId,
      eventDate: item.eventDate,
      amount: item.amount,
      paymentMethod: item.paymentMethod,
      attended: item.attended,
      memberSide: item.memberSide,
      notes: item.notes,
    });
    setModalOpen(true);
    if (item.name) {
      const hint = await api.matching.getHintForName(item.name);
      setHintMessage(hint || '');
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      emit('toast.show', { title: '입력 필요', message: '상대방 이름을 입력해주세요.', type: 'error' });
      return;
    }
    try {
      if (form.id) {
        await api.sent.update(
          form.id,
          form.name.trim(),
          form.phone,
          form.relationship,
          form.eventTypeId,
          form.eventDate,
          form.amount,
          form.paymentMethod,
          form.attended,
          form.memberSide,
          form.notes
        );
        emit('toast.show', { title: '수정 완료', message: '보낸 내역이 수정되었습니다.', type: 'success' });
      } else {
        await api.sent.create(
          form.name.trim(),
          form.phone,
          form.relationship,
          form.eventTypeId,
          form.eventDate,
          form.amount,
          form.paymentMethod,
          form.attended,
          form.memberSide,
          form.notes
        );
        emit('toast.show', { title: '등록 완료', message: `${form.name} 님에게 보낸 경조사비가 등록되었습니다.`, type: 'success' });
      }
      setModalOpen(false);
      loadSent();
    } catch (err) {
      emit('toast.show', { title: '저장 실패', message: String(err), type: 'error' });
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`${name} 님에게 보낸 내역을 삭제하시겠습니까?`)) return;
    try {
      await api.sent.delete(id);
      emit('toast.show', { title: '삭제 완료', message: '내역이 휴지통으로 이동되었습니다.', type: 'success' });
      loadSent();
    } catch (err) {
      emit('toast.show', { title: '삭제 실패', message: String(err), type: 'error' });
    }
  };

  const totalAmount = sentList.reduce((acc, cur) => acc + cur.amount, 0);

  return (
    <>
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">타인의 경조사 (보낸 돈)</h1>
          <p className="page-desc">지인, 동료, 친척 등의 결혼식, 장례식 등에 보낸 경조사비 지출을 기록합니다.</p>
        </div>
        <button type="button" className="btn" onClick={openCreate}>
          <Send size={16} /> 보낸 내역 등록
        </button>
      </header>

      {/* 요약 카드 */}
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="stat-label">보낸 총 횟수</div>
          <div className="stat-value">{sentList.length}건</div>
        </div>
        <div className="card">
          <div className="stat-label">보낸 총 금액</div>
          <div className="stat-value" style={{ color: 'var(--expense)' }}>
            {formatMoney(totalAmount)}
          </div>
        </div>
      </div>

      {/* 종류 필터 탭 & 검색창 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn-chip ${selectedTypeId === 0 ? 'btn' : ''}`}
            onClick={() => setSelectedTypeId(0)}
          >
            전체 보기
          </button>
          {types.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`btn-chip ${selectedTypeId === t.id ? 'btn' : ''}`}
              onClick={() => setSelectedTypeId(t.id)}
            >
              <span>{t.icon}</span> {t.name}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: 280 }}>
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
      </div>

      {/* 보낸 내역 테이블 */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 110 }}>날짜</th>
              <th style={{ width: 110 }}>이름</th>
              <th style={{ width: 130 }}>전화번호</th>
              <th style={{ width: 100 }}>관계</th>
              <th style={{ width: 110 }}>경조사 종류</th>
              <th style={{ width: 130, textAlign: 'right' }}>금액</th>
              <th style={{ width: 110 }}>지출 수단</th>
              <th style={{ width: 90, textAlign: 'center' }}>참석 여부</th>
              {isSharedMode && <th style={{ width: 100 }}>구분</th>}
              <th>비고</th>
              <th style={{ width: 100, textAlign: 'center' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {sentList.length === 0 ? (
              <tr>
                <td colSpan={isSharedMode ? 11 : 10} className="table-empty">
                  {search ? '검색된 내역이 없습니다.' : '등록된 보낸 내역이 없습니다. [보낸 내역 등록] 버튼을 눌러 추가해보세요.'}
                </td>
              </tr>
            ) : (
              sentList.map((item) => (
                <tr key={item.id}>
                  <td style={{ color: 'var(--fg-muted)' }}>{formatDate(item.eventDate)}</td>
                  <td style={{ fontWeight: 700 }}>{item.name}</td>
                  <td className="mono">{formatPhone(item.phone)}</td>
                  <td><span className="badge">{item.relationship}</span></td>
                  <td>
                    <span>{item.eventTypeIcon}</span> {item.eventTypeName}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--expense)' }}>
                    {formatMoney(item.amount)}
                  </td>
                  <td>{item.paymentMethod}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${item.attended ? 'badge-ok' : ''}`}>
                      {item.attended ? '참석' : '불참(송금)'}
                    </span>
                  </td>
                  {isSharedMode && <td><span className="badge">{item.memberSide || '공통'}</span></td>}
                  <td style={{ color: 'var(--fg-muted)', fontSize: '0.85rem' }}>{item.notes || '-'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                      <button
                        type="button"
                        className="btn-chip"
                        onClick={() => openEdit(item)}
                        title="수정"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn-chip btn-chip-clear"
                        onClick={() => handleDelete(item.id, item.name)}
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

      {/* 보낸 내역 등록/수정 모달 */}
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={form.id ? '보낸 경조사비 수정' : '타인 경조사비 지출 등록'}
        description="상대방의 경조사에 보낸 부의금/축의금을 기록합니다."
      >
        {/* 매칭 힌트 알림 박스 */}
        {hintMessage && (
          <div
            style={{
              background: 'hsl(18 100% 95%)',
              border: '1px solid hsl(16 88% 76%)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--brand-700)',
              fontSize: '0.88rem',
              fontWeight: 600,
            }}
          >
            <Lightbulb size={18} style={{ color: 'var(--brand-500)', flexShrink: 0 }} />
            <span>{hintMessage}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">상대방 이름 *</label>
            <input
              type="text"
              className="input-text"
              placeholder="이름 입력 (예: 홍길동)"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">전화번호</label>
            <input
              type="text"
              className="input-text"
              placeholder="010-0000-0000"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>

        {/* 금액 전용 입력기 컴포넌트 */}
        <div className="form-group">
          <label className="form-label">보낸 금액 *</label>
          <AmountInput
            value={form.amount}
            onChange={(val) => setForm({ ...form, amount: val })}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">경조사 종류 *</label>
            <select
              className="input-text"
              value={form.eventTypeId}
              onChange={(e) => setForm({ ...form, eventTypeId: Number(e.target.value) })}
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">경조사 날짜 *</label>
            <input
              type="date"
              className="input-text"
              value={form.eventDate}
              onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">관계</label>
            <Select
              value={form.relationship}
              onValueChange={(val) => setForm({ ...form, relationship: val })}
              options={RELATION_OPTIONS}
            />
          </div>
          <div className="form-group">
            <label className="form-label">지출 수단</label>
            <Select
              value={form.paymentMethod}
              onValueChange={(val) => setForm({ ...form, paymentMethod: val })}
              options={PAYMENT_OPTIONS}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.attended}
              onChange={(e) => setForm({ ...form, attended: e.target.checked })}
              style={{ width: 18, height: 18 }}
            />
            <span>직접 참석함 (체크 해제 시 송금/위탁 전달)</span>
          </label>
        </div>

        {isSharedMode && (
          <div className="form-group">
            <label className="form-label">지출 주체 (함께 사용)</label>
            <input
              type="text"
              className="input-text"
              placeholder="예: 본인, 배우자, 공동"
              value={form.memberSide}
              onChange={(e) => setForm({ ...form, memberSide: e.target.value })}
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">비고</label>
          <input
            type="text"
            className="input-text"
            placeholder="장소, 봉투 전달자, 메모 등"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
            취소
          </button>
          <button type="button" className="btn" onClick={handleSave}>
            저장
          </button>
        </div>
      </Modal>
    </>
  );
}
