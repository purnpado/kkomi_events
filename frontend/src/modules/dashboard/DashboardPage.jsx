import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../core/api';
import { useBusEvent } from '../../core/hooks';
import { formatMoney, formatNumber, numberToKorean } from '../../core/format';
import { TrendingUp, TrendingDown, Scale, Calendar, Users, ArrowUpRight, ArrowDownLeft, Sparkles, Globe } from 'lucide-react';

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);

  const loadSummary = useCallback(async () => {
    try {
      const data = await api.dashboard.getSummary();
      setSummary(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useBusEvent(['myevent.*', 'received.*', 'sent.*', 'eventtype.*', 'calendar.*'], () => {
    loadSummary();
  });

  const totalReceived = summary?.totalReceivedAmount || 0;
  const totalSent = summary?.totalSentAmount || 0;
  const netBalance = summary?.netBalance || 0;

  return (
    <div className="page-container">
      <header className="page-header">
        <h1 className="page-title">대시보드</h1>
        <p className="page-desc">받은 경조사비와 보낸 경조사비의 전반적인 입출 현황과 통계를 한눈에 확인합니다.</p>
      </header>

      {/* 핵심 4대 지표 카드 (토스 자산 카드 스타일) */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        {/* 총 받은 돈 */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-label">총 받은 경조사비</span>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--income-light)', display: 'grid', placeItems: 'center' }}>
                <ArrowDownLeft size={18} style={{ color: 'var(--income)' }} />
              </div>
            </div>
            <div className="stat-value" style={{ color: 'var(--income)' }}>
              <span>{formatNumber(totalReceived)}</span>
              <span className="stat-unit">원</span>
            </div>
            {Math.abs(totalReceived) >= 100000 && (
              <div className="stat-korean">({numberToKorean(totalReceived)})</div>
            )}
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--fg-muted)', marginTop: 8, fontWeight: 500 }}>
            총 <strong style={{ color: 'var(--fg)' }}>{summary?.totalReceivedCount || 0}건</strong> 입금
          </div>
        </div>

        {/* 총 보낸 돈 */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-label">총 보낸 경조사비</span>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--expense-light)', display: 'grid', placeItems: 'center' }}>
                <ArrowUpRight size={18} style={{ color: 'var(--expense)' }} />
              </div>
            </div>
            <div className="stat-value" style={{ color: 'var(--expense)' }}>
              <span>{formatNumber(totalSent)}</span>
              <span className="stat-unit">원</span>
            </div>
            {Math.abs(totalSent) >= 100000 && (
              <div className="stat-korean">({numberToKorean(totalSent)})</div>
            )}
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--fg-muted)', marginTop: 8, fontWeight: 500 }}>
            총 <strong style={{ color: 'var(--fg)' }}>{summary?.totalSentCount || 0}건</strong> 지출
          </div>
        </div>

        {/* 순수 차액 */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-label">수지 균형 (차액)</span>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--primary-light)', display: 'grid', placeItems: 'center' }}>
                <Scale size={18} style={{ color: 'var(--primary)' }} />
              </div>
            </div>
            <div className="stat-value">
              <span style={{ color: netBalance >= 0 ? 'var(--income)' : 'var(--expense)' }}>
                {netBalance >= 0 ? '+' : '-'}{formatNumber(Math.abs(netBalance))}
              </span>
              <span className="stat-unit" style={{ color: netBalance >= 0 ? 'var(--income)' : 'var(--expense)' }}>원</span>
            </div>
            {Math.abs(netBalance) >= 100000 && (
              <div className="stat-korean">({numberToKorean(Math.abs(netBalance))})</div>
            )}
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--fg-muted)', marginTop: 8, fontWeight: 500 }}>
            {netBalance >= 0 ? '👍 받은 금액이 더 많아요' : '💸 보낸 금액이 더 많아요'}
          </div>
        </div>

        {/* 다가오는 일정 */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-label">다가오는 경조사</span>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff7ed', display: 'grid', placeItems: 'center' }}>
                <Calendar size={18} style={{ color: '#ea580c' }} />
              </div>
            </div>
            <div className="stat-value" style={{ color: 'var(--fg)' }}>
              <span>{summary?.upcomingCount || 0}</span>
              <span className="stat-unit">건</span>
            </div>
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--fg-muted)', marginTop: 8, fontWeight: 500 }}>
            챙겨야 할 예정된 일정
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        {/* 최근 경조사 활동 피드 (나의 경조사 받은 돈 + 타인 경조사 보낸 돈 통합) */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={20} style={{ color: 'var(--primary)' }} /> 최근 경조사 내역
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', fontWeight: 600 }}>
              최근 {summary?.recentEvents?.length || 0}건
            </span>
          </div>

          <div>
            {(!summary?.recentEvents || summary.recentEvents.length === 0) ? (
              <p className="table-empty">아직 등록된 경조사 내역이 없습니다.</p>
            ) : (
              <ul className="list">
                {summary.recentEvents.map((item, idx) => {
                  const isReceived = item.type === 'received';
                  return (
                    <li
                      key={`${item.type}-${idx}-${item.name}-${item.eventDate}`}
                      style={{
                        padding: '12px 0',
                        borderBottom: '1px solid var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            background: isReceived ? 'var(--income-light)' : 'var(--expense-light)',
                            color: isReceived ? 'var(--income)' : 'var(--expense)',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {isReceived ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <strong style={{ fontSize: '0.98rem' }}>{item.name}</strong>
                            <span
                              className="badge"
                              style={{
                                background: isReceived ? 'var(--income-light)' : 'var(--expense-light)',
                                color: isReceived ? 'var(--income)' : 'var(--expense)',
                                fontSize: '0.74rem',
                                padding: '1px 8px',
                              }}
                            >
                              {isReceived ? '📥 받은 돈' : '📤 보낸 돈'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginTop: 2 }}>
                            <span>{item.eventTypeIcon} {item.eventTitle}</span>
                            <span style={{ margin: '0 6px' }}>·</span>
                            <span>{item.eventDate}</span>
                            {item.attendance && (
                              <>
                                <span style={{ margin: '0 6px' }}>·</span>
                                <span>{item.attendance}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: '1.08rem',
                            color: isReceived ? 'var(--income)' : 'var(--expense)',
                            letterSpacing: '-0.02em',
                          }}
                        >
                          {isReceived ? '+' : '-'}{formatMoney(item.amount)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* 우측 열: 다가오는 일정 + 종류별 비중 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* 다가오는 챙길 경조사 위젯 */}
          <div className="card">
            <h2 style={{ marginTop: 0, marginBottom: 14, fontSize: '1.18rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={20} style={{ color: '#ea580c' }} /> 다가오는 챙길 경조사
            </h2>
            {(!summary?.upcomingEvents || summary.upcomingEvents.length === 0) ? (
              <p style={{ margin: '14px 0', fontSize: '0.9rem', color: 'var(--fg-muted)' }}>
                예정된 경조사가 없습니다. 편안한 나날 되세요!
              </p>
            ) : (
              <ul className="list">
                {summary.upcomingEvents.map((up) => (
                  <li
                    key={`${up.source || 'local'}-${up.id}-${up.eventDate}`}
                    style={{
                      padding: '10px 0',
                      borderBottom: '1px solid var(--border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 9999,
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          background: up.daysLeft === 0 ? 'var(--expense)' : up.daysLeft <= 7 ? '#fff7ed' : 'var(--bg-sunken)',
                          color: up.daysLeft === 0 ? 'white' : up.daysLeft <= 7 ? '#ea580c' : 'var(--fg-muted)',
                        }}
                      >
                        {up.daysLeft === 0 ? '오늘' : `D-${up.daysLeft}`}
                      </span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <strong>{up.name}</strong>
                          {up.source === 'google' && (
                            <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.72rem', padding: '2px 6px' }}>
                              구글 캘린더
                            </span>
                          )}
                          {up.eventTitle && <span style={{ fontSize: '0.82rem', color: 'var(--fg-muted)' }}>({up.eventTypeIcon} {up.eventTitle})</span>}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>{up.eventDate}</div>
                      </div>
                    </div>
                    {up.amount > 0 ? (
                      <strong style={{ color: 'var(--fg)', whiteSpace: 'nowrap' }}>{formatMoney(up.amount)}</strong>
                    ) : (
                      <span style={{ fontSize: '0.82rem', color: 'var(--fg-muted)' }}>예정</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 경조사 종류별 지출 분포 */}
          <div className="card">
            <h2 style={{ marginTop: 0, marginBottom: 14, fontSize: '1.18rem', fontWeight: 800 }}>
              종류별 보낸 경조사비 비중
            </h2>
            <div>
              {(!summary?.categories || summary.categories.every((c) => c.amount === 0)) ? (
                <p className="table-empty" style={{ padding: '30px 20px' }}>아직 지출 통계 데이터가 없습니다.</p>
              ) : (
                <ul className="list">
                  {summary.categories.slice(0, 4).map((cat) => {
                    const percent = summary.totalSentAmount > 0
                      ? Math.round((cat.amount / summary.totalSentAmount) * 100)
                      : 0;
                    return (
                      <li key={cat.name} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '1.2rem', width: 30, height: 30, borderRadius: 8, background: 'var(--bg-sunken)', display: 'grid', placeItems: 'center' }}>
                              {cat.icon}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: '0.94rem' }}>{cat.name}</span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>{cat.count}건</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--expense)' }}>{formatMoney(cat.amount)}</span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginLeft: 6, fontWeight: 600 }}>{percent}%</span>
                          </div>
                        </div>
                        <div style={{ height: 5, width: '100%', background: 'var(--bg-sunken)', borderRadius: 9999, overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.min(100, Math.max(0, percent))}%`,
                              background: 'var(--expense)',
                              borderRadius: 9999,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
