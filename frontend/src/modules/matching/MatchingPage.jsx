import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../core/api';
import { useBusEvent } from '../../core/hooks';
import { formatMoney, formatPhone, formatDate } from '../../core/format';
import Modal from '../../ui/Modal';
import { Search, ArrowLeftRight, Clock, CheckCircle2, AlertCircle, TrendingUp, TrendingDown, Users, Printer } from 'lucide-react';

export default function MatchingPage() {
  const [summaries, setSummaries] = useState([]);
  const [filter, setFilter] = useState('all'); // all, need_pay, receive_back, balanced
  const [search, setSearch] = useState('');

  // 상세 보기 모달 상태
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personDetail, setPersonDetail] = useState(null);

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

  const handleOpenDetail = async (p) => {
    setSelectedPerson(p);
    try {
      const detail = await api.matching.getPersonDetail(p.name, p.phoneClean);
      setPersonDetail(detail);
      setDetailModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  // 통계 계산
  const needPayCount = summaries.filter((s) => s.balance > 0).length;
  const needPayTotal = summaries.filter((s) => s.balance > 0).reduce((acc, cur) => acc + cur.balance, 0);

  const receiveBackCount = summaries.filter((s) => s.balance < 0).length;
  const receiveBackTotal = summaries.filter((s) => s.balance < 0).reduce((acc, cur) => acc + Math.abs(cur.balance), 0);

  return (
    <>
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">사람별 경조사비 매칭</h1>
          <p className="page-desc">
            내 경조사에 축의·부의를 해주신 분들과 내가 보낸 내역을 이름별로 맞춰 갚을 차례인지 한눈에 확인합니다.
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
        <div className="card" style={{ borderColor: needPayCount > 0 ? 'var(--warn)' : 'var(--border)' }}>
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

      {/* 필터 탭 & 검색창 */}
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

        <div style={{ position: 'relative', width: 280 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--fg-muted)' }} />
          <input
            type="text"
            className="input-text"
            placeholder="이름, 전화번호, 관계 검색..."
            style={{ paddingLeft: 36 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* 매칭 데이터 테이블 */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 120 }}>이름</th>
              <th style={{ width: 130 }}>전화번호</th>
              <th style={{ width: 100 }}>관계</th>
              <th style={{ width: 150, textAlign: 'right' }}>내 경조사에 낸 돈</th>
              <th style={{ width: 150, textAlign: 'right' }}>내가 보낸 돈</th>
              <th style={{ width: 140, textAlign: 'right' }}>차액 (손익)</th>
              <th style={{ width: 140, textAlign: 'center' }}>상태</th>
              <th style={{ width: 100, textAlign: 'center' }}>주고받은 기록</th>
            </tr>
          </thead>
          <tbody>
            {summaries.length === 0 ? (
              <tr>
                <td colSpan={8} className="table-empty">
                  {search ? '검색된 매칭 인원이 없습니다.' : '아직 나의 경조사 또는 타인 경조사에 등록된 인원이 없습니다.'}
                </td>
              </tr>
            ) : (
              summaries.map((p, idx) => (
                <tr key={`${p.name}-${p.phoneClean}-${idx}`}>
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
                  <td style={{ textAlign: 'right', fontWeight: 800 }}>
                    {p.balance > 0 && <span style={{ color: 'var(--income)' }}>+{formatMoney(p.balance)}</span>}
                    {p.balance < 0 && <span style={{ color: 'var(--expense)' }}>-{formatMoney(Math.abs(p.balance))}</span>}
                    {p.balance === 0 && <span style={{ color: 'var(--fg-muted)' }}>0원</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {p.balance > 0 && (
                      <span className="badge" style={{ background: 'hsl(40 92% 92%)', color: 'hsl(30 80% 32%)' }}>
                        🟡 갚을 차례
                      </span>
                    )}
                    {p.balance < 0 && (
                      <span className="badge" style={{ background: 'hsl(212 70% 92%)', color: 'hsl(212 80% 32%)' }}>
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
                      onClick={() => handleOpenDetail(p)}
                      title="주고받은 전체 내역 보기"
                    >
                      <ArrowLeftRight size={13} /> 내역보기
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 사람별 상세 주고받은 타임라인 모달 */}
      <Modal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        title={`${selectedPerson?.name || ''} 님과의 경조사비 교환 내역`}
        description={`전화번호: ${formatPhone(selectedPerson?.phone) || '-'} · 관계: ${selectedPerson?.relationship || '-'}`}
        maxWidth="640px"
      >
        {personDetail && (
          <div>
            {/* 요약 박스 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 10,
                background: 'var(--bg-sunken)',
                padding: 14,
                borderRadius: 'var(--radius)',
                marginBottom: 20,
              }}
            >
              <div>
                <div className="stat-label">내 경조사에 받은 돈</div>
                <div style={{ fontWeight: 800, color: 'var(--income)', fontSize: '1.1rem', marginTop: 4 }}>
                  {formatMoney(personDetail.summary.receivedTotal)} ({personDetail.summary.receivedCount}회)
                </div>
              </div>
              <div>
                <div className="stat-label">내가 보낸 돈</div>
                <div style={{ fontWeight: 800, color: 'var(--expense)', fontSize: '1.1rem', marginTop: 4 }}>
                  {formatMoney(personDetail.summary.sentTotal)} ({personDetail.summary.sentCount}회)
                </div>
              </div>
              <div>
                <div className="stat-label">차액 현황</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: 4 }}>
                  {personDetail.summary.balance > 0 ? (
                    <span style={{ color: 'var(--income)' }}>+{formatMoney(personDetail.summary.balance)} (갚을 차례)</span>
                  ) : personDetail.summary.balance < 0 ? (
                    <span style={{ color: 'var(--expense)' }}>-{formatMoney(Math.abs(personDetail.summary.balance))} (받을 차례)</span>
                  ) : (
                    <span>0원 (균형)</span>
                  )}
                </div>
              </div>
            </div>

            {/* 타임라인 목록 */}
            <h3 style={{ margin: '0 0 12px', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={16} /> 주고받은 기록 일지
            </h3>

            {personDetail.history.length === 0 ? (
              <p className="table-empty">상세 기록이 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {personDetail.history.map((h, i) => (
                  <div
                    key={`${h.type}-${h.id}-${i}`}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: h.type === 'received' ? 'hsl(158 52% 98%)' : 'hsl(352 66% 98%)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`badge ${h.type === 'received' ? 'badge-ok' : 'badge-err'}`}>
                          {h.type === 'received' ? '📥 내 경조사에 받음' : '📤 상대 경조사에 보냄'}
                        </span>
                        <strong style={{ fontSize: '0.98rem' }}>{h.eventTitle}</strong>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginTop: 4 }}>
                        날짜: {formatDate(h.eventDate)} · 방법: {h.paymentMethod}
                        {h.notes && ` · 비고: ${h.notes}`}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: '1.15rem',
                        fontWeight: 800,
                        color: h.type === 'received' ? 'var(--income)' : 'var(--expense)',
                      }}
                    >
                      {h.type === 'received' ? '+' : '-'}{formatMoney(h.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
