import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../core/api';
import { emit } from '../core/eventBus';
import { formatMoney, formatDate } from '../core/format';
import Modal from './Modal';
import { Trash2, RotateCcw, AlertTriangle, Check, Search, ShieldAlert, ArrowDownLeft, ArrowUpRight, Calendar } from 'lucide-react';

export default function TrashModal({ isOpen, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('all'); // all, received, sent, my_event
  const [search, setSearch] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.trash.list();
      setItems(list || []);
    } catch (err) {
      console.error('휴지통 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadItems();
    }
  }, [isOpen, loadItems]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterType !== 'all' && item.itemType !== filterType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchSubtitle = (item.subtitle || '').toLowerCase().includes(q);
        if (!matchTitle && !matchSubtitle) return false;
      }
      return true;
    });
  }, [items, filterType, search]);

  const counts = useMemo(() => {
    const c = { all: items.length, received: 0, sent: 0, my_event: 0 };
    items.forEach((it) => {
      if (c[it.itemType] !== undefined) c[it.itemType]++;
    });
    return c;
  }, [items]);

  // 단일 항목 복원
  const handleRestore = async (item) => {
    try {
      await api.trash.restore(item.itemType, item.id);
      emit('toast.show', {
        title: '복원 완료',
        message: `'${item.title}' 내역이 정상적으로 복원되었습니다.`,
        type: 'success',
      });
      loadItems();
    } catch (err) {
      emit('toast.show', {
        title: '복원 실패',
        message: String(err),
        type: 'error',
      });
    }
  };

  // 단일 항목 영구 삭제
  const handlePurge = async (item) => {
    if (!window.confirm(`'${item.title}' 내역을 완전히 영구 삭제하시겠습니까?\n영구 삭제된 내역은 다시 되돌릴 수 없습니다.`)) {
      return;
    }
    try {
      await api.trash.purge(item.itemType, item.id);
      emit('toast.show', {
        title: '영구 삭제 완료',
        message: '항목이 데이터베이스에서 완전히 삭제되었습니다.',
        type: 'success',
      });
      loadItems();
    } catch (err) {
      emit('toast.show', {
        title: '영구 삭제 실패',
        message: String(err),
        type: 'error',
      });
    }
  };

  // 전체 복원
  const handleRestoreAll = async () => {
    if (items.length === 0) return;
    if (!window.confirm(`휴지통에 보관된 ${items.length}개 항목을 모두 원래 장부로 복원하시겠습니까?`)) {
      return;
    }
    try {
      const count = await api.trash.restoreAll();
      emit('toast.show', {
        title: '전체 복원 완료',
        message: `${count}개 항목이 모두 복원되었습니다.`,
        type: 'success',
      });
      loadItems();
    } catch (err) {
      emit('toast.show', {
        title: '복원 실패',
        message: String(err),
        type: 'error',
      });
    }
  };

  // 휴지통 비우기 (전체 영구 삭제)
  const handlePurgeAll = async () => {
    if (items.length === 0) return;
    if (!window.confirm(`⚠️ 경고: 휴지통의 모든 항목(${items.length}개)을 영구 삭제하시겠습니까?\n이 작업은 영구적이며 절대 취소할 수 없습니다!`)) {
      return;
    }
    try {
      const count = await api.trash.purgeAll();
      emit('toast.show', {
        title: '휴지통 비우기 완료',
        message: `${count}개 항목이 영구 정리되었습니다.`,
        type: 'success',
      });
      loadItems();
    } catch (err) {
      emit('toast.show', {
        title: '삭제 실패',
        message: String(err),
        type: 'error',
      });
    }
  };

  return (
    <Modal open={isOpen} onOpenChange={(val) => !val && onClose?.()} title="🗑️ 휴지통 (삭제 내역 복원 및 정리)" maxWidth="860px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* 안내 배너 */}
        <div
          style={{
            background: 'var(--bg-sunken)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.86rem',
            color: 'var(--fg-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div>
            💡 실수로 삭제한 축의금, 부의금, 행사 내역을 언제든 원래 장부로 되살릴 수 있습니다.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: '0.82rem', padding: '6px 12px' }}
              disabled={items.length === 0}
              onClick={handleRestoreAll}
            >
              <RotateCcw size={14} /> 전체 복원
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: '0.82rem', padding: '6px 12px', color: 'var(--expense)' }}
              disabled={items.length === 0}
              onClick={handlePurgeAll}
            >
              <Trash2 size={14} /> 휴지통 비우기
            </button>
          </div>
        </div>

        {/* 탭 필터 및 검색창 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: 'all', label: `전체 (${counts.all})` },
              { key: 'received', label: `받은 돈 (${counts.received})` },
              { key: 'sent', label: `보낸 돈 (${counts.sent})` },
              { key: 'my_event', label: `나의 행사 (${counts.my_event})` },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                className={`btn ${filterType === t.key ? '' : 'btn-ghost'}`}
                style={{ padding: '6px 12px', fontSize: '0.84rem' }}
                onClick={() => setFilterType(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: 220 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--fg-muted)' }} />
            <input
              type="text"
              className="input-text"
              placeholder="이름/행사 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 30, fontSize: '0.85rem', height: 34 }}
            />
          </div>
        </div>

        {/* 삭제 목록 테이블 */}
        <div className="table-container" style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid var(--border)' }}>
          {filteredItems.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--fg-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>🍃</div>
              <div style={{ fontWeight: 600 }}>휴지통이 비어 있습니다.</div>
              <div style={{ fontSize: '0.82rem', marginTop: 4 }}>삭제된 항목이 여기에 안전하게 보관됩니다.</div>
            </div>
          ) : (
            <table className="table" style={{ width: '100%', fontSize: '0.88rem' }}>
              <thead>
                <tr>
                  <th style={{ width: 130 }}>구분</th>
                  <th>이름 / 내용</th>
                  <th>세부 정보</th>
                  <th style={{ width: 110 }}>경조사 일자</th>
                  <th style={{ width: 110, textAlign: 'right' }}>금액</th>
                  <th style={{ width: 120 }}>삭제 일시</th>
                  <th style={{ width: 140, textAlign: 'center' }}>복원 / 삭제</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={`${item.itemType}-${item.id}`}>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background:
                            item.itemType === 'received'
                              ? 'var(--income-light)'
                              : item.itemType === 'sent'
                              ? 'var(--expense-light)'
                              : 'var(--bg-sunken)',
                          color:
                            item.itemType === 'received'
                              ? 'var(--income)'
                              : item.itemType === 'sent'
                              ? 'var(--expense)'
                              : 'var(--fg-main)',
                          fontSize: '0.74rem',
                          padding: '2px 8px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.typeLabel}
                      </span>
                    </td>
                    <td>
                      <strong style={{ fontSize: '0.94rem' }}>{item.title}</strong>
                    </td>
                    <td style={{ color: 'var(--fg-muted)', fontSize: '0.84rem' }}>
                      {item.subtitle || '-'}
                    </td>
                    <td style={{ fontSize: '0.84rem' }}>
                      {item.eventDate || '-'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      {item.amount > 0 ? (
                        <span style={{ color: item.itemType === 'received' ? 'var(--income)' : 'var(--expense)' }}>
                          {formatMoney(item.amount)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--fg-muted)' }}>-</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
                      {item.deletedAt ? item.deletedAt.slice(0, 16).replace('T', ' ') : '-'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: '4px 8px', fontSize: '0.78rem', color: 'var(--primary)' }}
                          onClick={() => handleRestore(item)}
                          title="정상 장부로 복원"
                        >
                          <RotateCcw size={13} /> 복원
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: '4px 8px', fontSize: '0.78rem', color: 'var(--expense)' }}
                          onClick={() => handlePurge(item)}
                          title="완전 영구 삭제"
                        >
                          <Trash2 size={13} /> 삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 닫기 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </Modal>
  );
}
