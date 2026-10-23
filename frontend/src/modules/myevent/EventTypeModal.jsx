import React, { useState } from 'react';
import Modal from '../../ui/Modal';
import { api } from '../../core/api';
import { emit } from '../../core/eventBus';
import { Plus, ArrowUp, ArrowDown, Trash2, Edit2, Check } from 'lucide-react';

const COMMON_ICONS = ['💍', '👶', '🕯️', '🎂', '🏠', '🎊', '💌', '🎓', '🎖️', '🚗', '✈️', '💼'];

export default function EventTypeModal({ open, onOpenChange, eventTypes = [], onRefresh }) {
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🎉');
  const [isAdding, setIsAdding] = useState(false);

  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setName('');
    setIcon('🎉');
  };

  const startEdit = (t) => {
    setIsAdding(false);
    setEditingId(t.id);
    setName(t.name);
    setIcon(t.icon);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      emit('toast.show', { title: '입력 필요', message: '탭 이름을 입력해주세요.', type: 'error' });
      return;
    }
    try {
      if (isAdding) {
        await api.eventtype.create(name.trim(), icon, '#E86343');
        emit('toast.show', { title: '탭 추가 완료', message: `'${name}' 탭이 추가되었습니다.`, type: 'success' });
      } else if (editingId) {
        await api.eventtype.update(editingId, name.trim(), icon, '#E86343', false);
        emit('toast.show', { title: '탭 수정 완료', message: '탭 정보가 변경되었습니다.', type: 'success' });
      }
      setIsAdding(false);
      setEditingId(null);
      setName('');
      onRefresh();
    } catch (err) {
      emit('toast.show', { title: '오류', message: String(err), type: 'error' });
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`'${title}' 탭을 정말 삭제하시겠습니까?`)) return;
    try {
      await api.eventtype.delete(id);
      emit('toast.show', { title: '삭제 완료', message: '탭이 삭제되었습니다.', type: 'success' });
      onRefresh();
    } catch (err) {
      emit('toast.show', { title: '삭제 불가', message: String(err), type: 'error' });
    }
  };

  const handleMove = async (idx, direction) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= eventTypes.length) return;
    const newOrder = [...eventTypes];
    const [moved] = newOrder.splice(idx, 1);
    newOrder.splice(targetIdx, 0, moved);
    try {
      await api.eventtype.reorder(newOrder.map((t) => t.id));
      onRefresh();
    } catch (err) {
      emit('toast.show', { title: '순서 변경 오류', message: String(err), type: 'error' });
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="경조사 탭(종류) 관리"
      description="나의 경조사 및 타인 경조사에서 사용할 탭 종류를 추가하거나 순서를 바꿉니다."
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        {!isAdding && !editingId && (
          <button type="button" className="btn" onClick={startAdd}>
            <Plus size={16} /> 새 탭 추가
          </button>
        )}
      </div>

      {(isAdding || editingId) && (
        <div className="card" style={{ marginBottom: 16, background: 'var(--bg-sunken)' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>
            {isAdding ? '새 탭 추가' : '탭 수정'}
          </h3>
          <div className="form-group">
            <label className="form-label">탭 이름</label>
            <input
              type="text"
              className="input-text"
              placeholder="예: 집들이, 고희연, 승진 등"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">아이콘</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {COMMON_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`btn-chip ${icon === emoji ? 'btn' : ''}`}
                  style={{ fontSize: '1.2rem', padding: '4px 8px' }}
                  onClick={() => setIcon(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setIsAdding(false);
                setEditingId(null);
              }}
            >
              취소
            </button>
            <button type="button" className="btn" onClick={handleSave}>
              <Check size={16} /> 저장
            </button>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 60, textAlign: 'center' }}>순서</th>
              <th style={{ width: 60, textAlign: 'center' }}>아이콘</th>
              <th>탭 이름</th>
              <th style={{ width: 140, textAlign: 'center' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {eventTypes.map((t, idx) => (
              <tr key={t.id}>
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                    <button
                      type="button"
                      className="btn-chip"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, -1)}
                      title="위로"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      className="btn-chip"
                      disabled={idx === eventTypes.length - 1}
                      onClick={() => handleMove(idx, 1)}
                      title="아래로"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>
                </td>
                <td style={{ textAlign: 'center', fontSize: '1.2rem' }}>{t.icon}</td>
                <td style={{ fontWeight: 600 }}>{t.name}</td>
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                    <button
                      type="button"
                      className="btn-chip"
                      onClick={() => startEdit(t)}
                      title="수정"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn-chip btn-chip-clear"
                      onClick={() => handleDelete(t.id, t.name)}
                      title="삭제"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
