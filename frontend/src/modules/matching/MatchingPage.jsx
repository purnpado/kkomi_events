import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../core/api';
import { useBusEvent } from '../../core/hooks';
import { formatMoney, formatPhone, formatDate } from '../../core/format';
import Modal from '../../ui/Modal';
import { Search, ArrowLeftRight, Clock, CheckCircle2, AlertCircle, TrendingUp, TrendingDown, Users, Printer, ArrowUpDown, ArrowUp, ArrowDown, User, Scale, ArrowRight, X } from 'lucide-react';

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
      setActivePerson(null);
      setActivePersonDetail(null);
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
  const needPayTotal = summaries.filter((s) => s.balance > 0).reduce((acc, cur) => acc + cur.balance, 0);

  const receiveBackCount = summaries.filter((s) => s.balance < 0).length;
  const receiveBackTotal = summaries.filter((s) => s.balance < 0).reduce((acc, cur) => acc + Math.abs(cur.balance), 0);

  return (
    <div className="page-container">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">주고받은 내역</h1>
          <p className="page-desc">
            지인과 주고받은 경조사비를 사람별로 맞춰보고 1:1 대조 분석과 타임라인을 확인합니다.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => window.print()}
          title="사람별 매칭 현황 인쇄 또는 PDF 저장"
        >
          <Printer size={16} /> 인쇄/PDF
        </button>
      </header>

      {/* 요약 통계 카드 */}
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="stat-label">교환 인원</div>
          <div className="stat-value">{summaries.length}명</div>
        </div>
        <div className="card" style={{ borderColor: needPayCount > 0 ? 'var(--warn)' : 'var(--border-light)' }}>
          <div className="stat-label" style={{ color: 'var(--warn)' }}>🟡 갚을 차례 (받음 &gt; 보냄)</div>
          <div className="stat-value" style={{ color: 'var(--income)' }}>
            {needPayCount}명 ({formatMoney(needPayTotal)})
          </div>
        </div>
        <div className="card">
          <div className="stat-label" style={{ color: 'var(--info)' }}>🔵 받을 차례 (보냄 &gt; 받음)</div>
          <div className="stat-value" style={{ color: 'var(--expense)' }}>
            {receiveBackCount}명 ({formatMoney(receiveBackTotal)})
          </div>
        </div>
        <div className="card">
          <div className="stat-label">🟢 균형 완료</div>
          <div className="stat-value">{summaries.filter((s) => s.balance === 0).length}명</div>
        </div>
      </div>

      {/* 필터 탭 & 사람 이름 빠른 검색창 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn-chip ${filter === 'all' ? 'btn' : ''}`}
            onClick={() => setFilter('all')}
          >
            전체 보기
          </button>
          <button
            type="button"
            className={`btn-chip ${filter === 'need_pay' ? 'btn' : ''}`}
            onClick={() => setFilter('need_pay')}
          >
            🟡 갚을 차례만 보기
          </button>
          <button
            type="button"
            className={`btn-chip ${filter === 'receive_back' ? 'btn' : ''}`}
            onClick={() => setFilter('receive_back')}
          >
            🔵 받을 차례만 보기
          </button>
          <button
            type="button"
            className={`btn-chip ${filter === 'balanced' ? 'btn' : ''}`}
            onClick={() => setFilter('balanced')}
          >
            🟢 균형 인원 보기
          </button>
        </div>

        <div style={{ position: 'relative', width: 300 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--fg-muted)' }} />
          <input
            type="text"
            className="input-text"
            placeholder="사람 이름으로 1:1 대조 검색..."
            style={{ paddingLeft: 36 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
                  1:1 맞춤 경조사비 상호 대조 분석 리포트
                </div>
              </div>
            </div>
            <button type="button" className="dialog-close-btn" onClick={handleCloseReport} title="대조 리포트 닫기">
              <X size={18} />
            </button>
          </div>

          {/* 3분할 상호 대조 레이아웃 (토스 저울 비교 스타일) */}
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

            {/* 중앙: 대조 저울 및 상태 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '10px 0' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary-subtle)', display: 'grid', placeItems: 'center', marginBottom: 8 }}>
                <Scale size={22} style={{ color: 'var(--primary)' }} />
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 4 }}>
                차액 현황
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: activePersonDetail.summary.balance > 0 ? 'var(--income)' : activePersonDetail.summary.balance < 0 ? 'var(--expense)' : 'var(--fg)' }}>
                {activePersonDetail.summary.balance > 0 ? `+${formatMoney(activePersonDetail.summary.balance)}` : activePersonDetail.summary.balance < 0 ? `-${formatMoney(Math.abs(activePersonDetail.summary.balance))}` : '0원'}
              </div>
              <div style={{ marginTop: 6 }}>
                {activePersonDetail.summary.balance > 0 ? (
                  <span className="badge" style={{ background: '#fff7ed', color: '#ea580c', fontSize: '0.74rem' }}>
                    갚을 차례
                  </span>
                ) : activePersonDetail.summary.balance < 0 ? (
                  <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '0.74rem' }}>
                    받을 차례
                  </span>
                ) : (
                  <span className="badge badge-ok" style={{ fontSize: '0.74rem' }}>
                    균형 완료
                  </span>
                )}
              </div>
            </div>

            {/* 우측: 상대방이 내게 낸 돈 */}
            <div style={{ background: 'var(--bg-sunken)', padding: 18, borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--income)' }}>📥 {activePerson.name} 님이 낸 돈 (수입)</span>
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
        </div>
      )}

      {/* 매칭 데이터 테이블 */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => requestSort('name')} style={{ width: 120, cursor: 'pointer', userSelect: 'none' }}>
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
              <th onClick={() => requestSort('receivedTotal')} style={{ width: 160, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  내 경조사에 낸 돈 {renderSortIcon('receivedTotal')}
                </div>
              </th>
              <th onClick={() => requestSort('sentTotal')} style={{ width: 160, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  내가 보낸 돈 {renderSortIcon('sentTotal')}
                </div>
              </th>
              <th onClick={() => requestSort('balance')} style={{ width: 150, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  차액 (손익) {renderSortIcon('balance')}
                </div>
              </th>
              <th onClick={() => requestSort('balance')} style={{ width: 130, textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  상태 {renderSortIcon('balance')}
                </div>
              </th>
              <th style={{ width: 110, textAlign: 'center' }}>1:1 대조</th>
            </tr>
          </thead>
          <tbody>
            {sortedSummaries.length === 0 ? (
              <tr>
                <td colSpan={8} className="table-empty">
                  {search ? '검색된 매칭 인원이 없습니다.' : '아직 나의 경조사 또는 타인 경조사에 등록된 인원이 없습니다.'}
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
                        <ArrowLeftRight size={13} /> 1:1 대조
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
