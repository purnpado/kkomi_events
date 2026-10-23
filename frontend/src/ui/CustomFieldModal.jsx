import React, { useState, useEffect, useCallback } from 'react';
import Modal from './Modal';
import Select from './Select';
import { api } from '../core/api';
import { emit } from '../core/eventBus';
import { Plus, Trash2, SlidersHorizontal, Tag, Hash, Calendar, CheckSquare } from 'lucide-react';

const FIELD_TYPES = [
  { value: 'text', label: '텍스트 (한 줄 글자)', icon: Tag },
  { value: 'number', label: '숫자 (매수, 번호 등)', icon: Hash },
  { value: 'date', label: '날짜', icon: Calendar },
  { value: 'checkbox', label: '체크박스 (예/아니오)', icon: CheckSquare },
];

export default function CustomFieldModal({ open, onOpenChange, targetMenu, targetTitle = '이 메뉴' }) {
  const [fields, setFields] = useState([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadFields = useCallback(async () => {
    if (!open) return;
    try {
      setLoading(true);
      const list = await api.customfield.listFields(targetMenu);
      setFields(list || []);
    } catch (err) {
      console.error(err);
      setErrorMsg('항목 목록을 불러오지 못했습니다: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  }, [open, targetMenu]);

  useEffect(() => {
    loadFields();
    setNewFieldName('');
    setNewFieldType('text');
    setErrorMsg('');
  }, [loadFields]);

  const handleAddField = async (e) => {
    e.preventDefault();
    const trimmed = newFieldName.trim();
    if (!trimmed) {
      setErrorMsg('추가할 항목 이름을 입력해주세요.');
      return;
    }
    setErrorMsg('');

    try {
      await api.customfield.createField(targetMenu, trimmed, newFieldType);
      emit('toast.show', {
        title: '항목 추가 완료',
        description: `"${trimmed}" 항목이 표와 입력창에 추가되었습니다.`,
        variant: 'success',
      });
      setNewFieldName('');
      loadFields();
    } catch (err) {
      setErrorMsg('추가 실패: ' + (err.message || err));
    }
  };

  const handleDeleteField = async (id, name) => {
    if (!window.confirm(`"${name}" 항목을 삭제하시겠습니까?\n이 항목에 기록된 값들도 함께 삭제됩니다.`)) {
      return;
    }
    try {
      await api.customfield.deleteField(id);
      emit('toast.show', {
        title: '항목 삭제 완료',
        description: `"${name}" 항목이 삭제되었습니다.`,
        variant: 'info',
      });
      loadFields();
    } catch (err) {
      setErrorMsg('삭제 실패: ' + (err.message || err));
    }
  };

  const getTypeName = (type) => {
    switch (type) {
      case 'number':
        return '숫자';
      case 'date':
        return '날짜';
      case 'checkbox':
        return '체크박스';
      default:
        return '텍스트';
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`${targetTitle} 맞춤 항목 관리`}
      description="필요한 정보(예: 식권 매수, 방명록 번호, 답례품 종류 등)를 자유롭게 추가하여 장부를 맞춤 구성하세요."
      maxWidth="560px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {errorMsg && <div className="alert-error">{errorMsg}</div>}

        {/* 새 항목 추가 박스 */}
        <form
          onSubmit={handleAddField}
          style={{
            background: 'var(--bg-sunken)',
            padding: '16px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <SlidersHorizontal size={16} color="var(--brand-600)" />
            새 맞춤 항목 추가
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px auto', gap: '8px' }}>
            <input
              type="text"
              className="input-text"
              placeholder="예: 식권 매수, 방명록 번호"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
            />
            <Select
              value={newFieldType}
              onValueChange={setNewFieldType}
              options={FIELD_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            />
            <button type="submit" className="btn" style={{ whiteSpace: 'nowrap', padding: '0 16px' }}>
              <Plus size={16} /> 추가
            </button>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
            💡 추가된 항목은 데이터 입력 모달창과 장부 표의 오른쪽 열에 바로 나타납니다.
          </div>
        </form>

        {/* 현재 항목 목록 */}
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '8px', color: 'var(--fg)' }}>
            현재 사용 중인 맞춤 항목 ({fields.length}개)
          </div>

          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--fg-muted)' }}>불러오는 중...</div>
          ) : fields.length === 0 ? (
            <div
              style={{
                padding: '30px 16px',
                textAlign: 'center',
                background: 'var(--bg-sunken)',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border)',
                color: 'var(--fg-muted)',
                fontSize: '0.88rem',
              }}
            >
              아직 추가된 맞춤 항목이 없습니다.
              <br />
              위에서 식권 번호나 답례품 종류 등을 추가해 보세요!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
              {fields.map((f) => (
                <div
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--bg-elev)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{f.fieldName}</span>
                    <span className="badge">{getTypeName(f.fieldType)}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-chip btn-chip-clear"
                    onClick={() => handleDeleteField(f.id, f.fieldName)}
                    title="항목 삭제"
                    style={{ padding: '5px 8px' }}
                  >
                    <Trash2 size={15} /> 삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 하단 닫기 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px' }}>
          <button type="button" className="btn btn-ghost" onClick={() => onOpenChange(false)}>
            닫기
          </button>
        </div>
      </div>
    </Modal>
  );
}
