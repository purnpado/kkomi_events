import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../core/api';
import { useBusEvent } from '../../core/hooks';
import { formatMoney, formatPhone, formatDate } from '../../core/format';
import { Search, ArrowLeftRight, Printer, ArrowUpDown, ArrowUp, ArrowDown, User, Scale, ArrowRight, X, Calendar, Sparkles } from 'lucide-react';

export default function MatchingPage() {
  const [summaries, setSummaries] = useState([]);
  const [filter, setFilter] = useState('all'); // all, need_pay, receive_back, balanced
  const [search, setSearch] = useState('');

  // 1:1 스마트 대조 리포트 상태
  const [activePerson, setActivePerson] = useState(null);
  const [activePersonDetail, setActivePersonDetail] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // 테이블 정렬 상태
  const [sortConfig, setSortConfig] = useState({ key: 'balance', order: 'desc' });

  const loadSummaries = useCallback(async () => {
    try {
      const list = await api.matching.listSummaries(filter, search);
      setSummaries(list || []);
    } catch (err) {
      console.error(err);
    }
  }, [filter, search]);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries]);

  useBusEvent(['received.*', 'sent.*', 'myevent.*'], () => {
    loadSummaries();
  });

  // 검색창 입력 시 정확히 일치하거나 1명인 경우 자동으로 1:1 대조 리포트 로드
  useEffect(() => {
    if (!search.trim()) {
      return;
    }
    const matched = summaries.filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()));
    if (matched.length === 1) {
      loadPersonDetail(matched[0]);
    }
  }, [search, summaries]);

  const loadPersonDetail = async (p) => {
    setActivePerson(p);
    setReportLoading(true);
    try {
      const detail = await api.matching.getPersonDetail(p.name, p.phoneClean);
      setActivePersonDetail(detail);
    } catch (err) {
      console.error(err);
    } finally {
      setReportLoading(false);
    }
  };

  const handleSelectPerson = (p) => {
    loadPersonDetail(p);
  };

  const handleCloseReport = () => {
    setActivePerson(null);
    setActivePersonDetail(null);
  };

  const requestSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { key, order: (key === 'balance' || key === 'receivedTotal' || key === 'sentTotal') ? 'desc' : 'asc' };
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

  const sortedSummaries = useMemo(() => {
    if (!summaries || summaries.length === 0) return [];
    return [...summaries].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';

      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal, 'ko');
        return sortConfig.order === 'asc' ? cmp : -cmp;
      }
      if (typeof aVal === 'number') {
        return sortConfig.order === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  }, [summaries, sortConfig]);

  // 통계 계산
  const needPayCount = summaries.filter((s) => s.balance > 0).length;
  const receiveBackCount = summaries.filter((s) => s.balance < 0).length;
  const balancedCount = summaries.filter((s) => s.balance === 0).length;

  return (
    <div className="page-container">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">경조사비 조회</h1>
          <p className="page-desc">
            지인 이름을 검색하여 내가 보낸 경조사비와 상대방이 낸 축의·부의금을 1:1로 비교 조회합니다.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => window.print()}
          title="경조사비 조회 현황 인쇄 또는 PDF 저장"
        >
          <Printer size={16} /> 인쇄/PDF
        </button>
      </header>

      {/* 🔍 지인 이름 중심의 직관적 검색 바 */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: 16,
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: 14, color: 'var(--primary)' }} />
            <input
              type="text"
              className="input-text"
              placeholder="조회할 지인의 이름을 입력하세요 (예: 홍길동, 010...)"
              style={{
                paddingLeft: 42,
                paddingRight: search ? 36 : 14,
                fontSize: '1.02rem',
                fontWeight: 600,
                height: 46,
                borderColor: 'var(--primary-light)',
              }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: 13,
                  background: 'none',
                  border: 'none',
                  color: 'var(--fg-muted)',
                  cursor: 'pointer',
                }}
                title="검색어 지우기"
              >
                <X size={18} />
              </button>
            )}
          </div>
          {search && (
            <div style={{ fontSize: '0.88rem', color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
              검색 결과: <strong>{summaries.length}</strong>명
            </div>
          )}
        </div>

        {/* 간결한 분류 칩 (필요 시 선택) */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginRight: 4 }}>빠른 보기:</span>
          <button
            type="button"
            className={`btn-chip ${filter === 'all' ? 'btn' : ''}`}
            onClick={() => setFilter('all')}
            style={{ fontSize: '0.82rem', padding: '3px 10px' }}
          >
            전체 ({summaries.length}명)
          </button>
          <button
            type="button"
            className={`btn-chip ${filter === 'need_pay' ? 'btn' : ''}`}
            onClick={() => setFilter('need_pay')}
            style={{ fontSize: '0.82rem', padding: '3px 10px' }}
          >
            🟡 갚을 차례 ({needPayCount}명)
          </button>
          <button
            type="button"
            className={`btn-chip ${filter === 'receive_back' ? 'btn' : ''}`}
            onClick={() => setFilter('receive_back')}
            style={{ fontSize: '0.82rem', padding: '3px 10px' }}
          >
            🔵 받을 차례 ({receiveBackCount}명)
          </button>
          <button
            type="button"
            className={`btn-chip ${filter === 'balanced' ? 'btn' : ''}`}
            onClick={() => setFilter('balanced')}
            style={{ fontSize: '0.82rem', padding: '3px 10px' }}
          >
            🟢 균형 ({balancedCount}명)
          </button>
        </div>
      </div>

      {/* ⭐ 1:1 상호 대조 스마트 리포트 카드 (검색 또는 클릭 시 자동 전개) */}
      {activePerson && activePersonDetail && (
        <div className="card" style={{ marginBottom: 20, border: '2px solid var(--primary)', background: '#ffffff', animation: 'rise 0.25s var(--ease)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-light)', paddingBottom: 14, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'grid', placeItems: 'center' }}>
                <User size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>{activePerson.name}</h2>
                  <span className="badge">{activePerson.relationship || '지인'}</span>
                  {activePerson.phone && <span className="mono" style={{ fontSize: '0.85rem', color: 'var(--fg-muted)' }}>{formatPhone(activePerson.phone)}</span>}
                </div>
                <div style={{ fontSize: '0.86rem', color: 'var(--fg-muted)', marginTop: 2 }}>
                  1:1 경조사비 맞춤 대조 및 교환 일지 리포트
                </div>
              </div>
            </div>
            <button type="button" className="dialog-close-btn" onClick={handleCloseReport} title="대조 리포트 닫기">
              <X size={18} />
            </button>
          </div>

          {/* 3분할 상호 대조 레이아웃 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr', gap: 14, alignItems: 'stretch', marginBottom: 20 }}>
            {/* 좌측: 내가 보낸 돈 */}
            <div style={{ background: 'var(--bg-sunken)', padding: 18, borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--expense)' }}>📤 내가 보낸 경조사비 (지출)</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', fontWeight: 600 }}>총 {activePersonDetail.summary.sentCount}건</span>
                </div>
                <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--expense)', letterSpacing: '-0.02em' }}>
                  {formatMoney(activePersonDetail.summary.sentTotal)}
                </div>
              </div>
              <div style={{ marginTop: 12, borderTop: '1px solid var(--border-light)', paddingTop: 10 }}>
                {activePersonDetail.history.filter((h) => h.type === 'sent').length === 0 ? (
                  <span style={{ fontSize: '0.82rem', color: 'var(--fg-muted)' }}>보낸 내역 없음</span>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {activePersonDetail.history.filter((h) => h.type === 'sent').map((h) => (
                      <li key={h.id} style={{ fontSize: '0.84rem', display: 'flex', justifyContent: 'space-between', color: 'var(--fg-muted)' }}>
                        <span>{h.eventDate} ({h.eventTitle})</span>
                        <strong style={{ color: 'var(--expense)' }}>{formatMoney(h.amount)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* 중앙: 대조 저울 및 판정 */}
            <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-sunken)', display: 'grid', placeItems: 'center', color: 'var(--fg-subtle)' }}>
                <Scale size={18} />
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', fontWeight: 600 }}>주고받은 차액</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                {activePersonDetail.summary.balance > 0 ? (
                  <span style={{ color: 'var(--income)' }}>+{formatMoney(activePersonDetail.summary.balance)}</span>
                ) : activePersonDetail.summary.balance < 0 ? (
                  <span style={{ color: 'var(--expense)' }}>-{formatMoney(Math.abs(activePersonDetail.summary.balance))}</span>
                ) : (
                  <span style={{ color: 'var(--fg-muted)' }}>0원</span>
                )}
              </div>
              <div>
                {activePersonDetail.summary.balance > 0 && (
                  <span className="badge" style={{ background: '#fff7ed', color: '#ea580c', fontSize: '0.76rem' }}>
                    🟡 갚을 차례
                  </span>
                )}
                {activePersonDetail.summary.balance < 0 && (
                  <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '0.76rem' }}>
                    🔵 받을 차례
                  </span>
                )}
                {activePersonDetail.summary.balance === 0 && (
                  <span className="badge badge-ok" style={{ fontSize: '0.76rem' }}>
                    🟢 균형 완료
                  </span>
                )}
              </div>
            </div>

            {/* 우측: 상대방이 낸 돈 */}
            <div style={{ background: 'var(--bg-sunken)', padding: 18, borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--income)' }}>📥 상대방이 낸 축의·부의금 (수입)</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', fontWeight: 600 }}>총 {activePersonDetail.summary.receivedCount}건</span>
                </div>
                <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--income)', letterSpacing: '-0.02em' }}>
                  {formatMoney(activePersonDetail.summary.receivedTotal)}
                </div>
              </div>
              <div style={{ marginTop: 12, borderTop: '1px solid var(--border-light)', paddingTop: 10 }}>
                {activePersonDetail.history.filter((h) => h.type === 'received').length === 0 ? (
                  <span style={{ fontSize: '0.82rem', color: 'var(--fg-muted)' }}>받은 내역 없음</span>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {activePersonDetail.history.filter((h) => h.type === 'received').map((h) => (
                      <li key={h.id} style={{ fontSize: '0.84rem', display: 'flex', justifyContent: 'space-between', color: 'var(--fg-muted)' }}>
                        <span>{h.eventDate} ({h.eventTitle})</span>
                        <strong style={{ color: 'var(--income)' }}>{formatMoney(h.amount)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* 하단 시간순 전체 교환 일지 */}
          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Calendar size={15} style={{ color: 'var(--primary)' }} />
              <strong style={{ fontSize: '0.9rem', color: 'var(--fg)' }}>전체 주고받은 타임라인 일지</strong>
            </div>
            {activePersonDetail.history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--fg-muted)', fontSize: '0.88rem' }}>
                교환된 내역이 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activePersonDetail.history.map((item, idx) => (
                  <div
                    key={`${item.type}-${item.id}-${idx}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'var(--bg-sunken)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.88rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        className={`badge ${item.type === 'received' ? 'badge-ok' : 'badge-err'}`}
                        style={{ fontSize: '0.78rem' }}
                      >
                        {item.type === 'received' ? '📥 받음' : '📤 보냄'}
                      </span>
                      <strong style={{ color: 'var(--fg)' }}>{item.eventTitle}</strong>
                      <span style={{ color: 'var(--fg-muted)', fontSize: '0.82rem' }}>{formatDate(item.eventDate)}</span>
                      {item.notes && <span style={{ color: 'var(--fg-subtle)', fontSize: '0.8rem' }}>({item.notes})</span>}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.98rem', color: item.type === 'received' ? 'var(--income)' : 'var(--expense)' }}>
                      {item.type === 'received' ? '+' : '-'}{formatMoney(item.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 전체 인원 목록 테이블 */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => requestSort('name')} style={{ minWidth: 100, cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  이름 {renderSortIcon('name')}
                </div>
              </th>
              <th style={{ minWidth: 135 }}>전화번호</th>
              <th onClick={() => requestSort('relationship')} style={{ minWidth: 85, cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  관계 {renderSortIcon('relationship')}
                </div>
              </th>
              <th onClick={() => requestSort('receivedTotal')} style={{ minWidth: 125, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  상대방이 낸 돈 (받음) {renderSortIcon('receivedTotal')}
                </div>
              </th>
              <th onClick={() => requestSort('sentTotal')} style={{ minWidth: 125, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  내가 보낸 돈 (지출) {renderSortIcon('sentTotal')}
                </div>
              </th>
              <th onClick={() => requestSort('balance')} style={{ minWidth: 130, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  차액 저울 {renderSortIcon('balance')}
                </div>
              </th>
              <th onClick={() => requestSort('balance')} style={{ minWidth: 110, textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  상태 {renderSortIcon('balance')}
                </div>
              </th>
              <th style={{ minWidth: 95, textAlign: 'center' }}>조회</th>
            </tr>
          </thead>
          <tbody>
            {sortedSummaries.length === 0 ? (
              <tr>
                <td colSpan={8} className="table-empty">
                  <div className="empty-state-box">
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: '50%',
                        background: 'var(--bg-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--fg-muted)',
                      }}
                    >
                      <Search size={24} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1.02rem', color: 'var(--fg)', marginBottom: 4 }}>
                        {search ? `'${search}' 검색된 지인이 없습니다.` : '등록된 경조사 인원이 없습니다.'}
                      </div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--fg-muted)' }}>
                        {search
                          ? '이름 또는 전화번호를 다시 확인해 보세요.'
                          : '나의 경조사나 타인 경조사에 내역을 등록하면 자동으로 1:1 대조가 완성됩니다.'}
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              sortedSummaries.map((p, idx) => {
                const isSelected = activePerson?.name === p.name;
                return (
                  <tr
                    key={`${p.name}-${p.phoneClean}-${idx}`}
                    style={{
                      background: isSelected ? 'var(--primary-subtle)' : undefined,
                      cursor: 'pointer',
                    }}
                    onClick={() => handleSelectPerson(p)}
                  >
                    <td style={{ fontWeight: 800 }}>{p.name}</td>
                    <td className="mono">{formatPhone(p.phone)}</td>
                    <td><span className="badge">{p.relationship || '지인'}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      {p.receivedCount > 0 ? (
                        <div>
                          <strong style={{ color: 'var(--income)' }}>{formatMoney(p.receivedTotal)}</strong>
                          <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>({p.receivedCount}회)</div>
                        </div>
                      ) : (
                        <span className="stat-label">없음</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {p.sentCount > 0 ? (
                        <div>
                          <strong style={{ color: 'var(--expense)' }}>{formatMoney(p.sentTotal)}</strong>
                          <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>({p.sentCount}회)</div>
                        </div>
                      ) : (
                        <span className="stat-label">없음</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '1.02rem' }}>
                      {p.balance > 0 ? (
                        <span style={{ color: 'var(--income)' }}>+{formatMoney(p.balance)}</span>
                      ) : p.balance < 0 ? (
                        <span style={{ color: 'var(--expense)' }}>-{formatMoney(Math.abs(p.balance))}</span>
                      ) : (
                        <span style={{ color: 'var(--fg-muted)' }}>0원</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {p.balance > 0 && (
                        <span className="badge" style={{ background: '#fff7ed', color: '#ea580c', fontWeight: 800 }}>
                          🟡 갚을 차례
                        </span>
                      )}
                      {p.balance < 0 && (
                        <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 800 }}>
                          🔵 받을 차례
                        </span>
                      )}
                      {p.balance === 0 && (
                        <span className="badge badge-ok">
                          🟢 균형
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn-chip"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectPerson(p);
                        }}
                        title="1:1 상호 대조 분석 리포트 보기"
                      >
                        <ArrowLeftRight size={13} /> 상세 조회
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
