import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../core/api';
import { useBusEvent } from '../../core/hooks';
import { formatMoney } from '../../core/format';
import { MonthlyBarChart } from './CanvasChart';
import { TrendingUp, TrendingDown, Scale, Calendar, Users, ArrowUpRight, ArrowDownLeft, Sparkles } from 'lucide-react';

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

  useBusEvent(['myevent.*', 'received.*', 'sent.*', 'eventtype.*'], () => {
    loadSummary();
  });

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
              {formatMoney(summary?.totalReceivedAmount || 0)}
            </div>
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
              {formatMoney(summary?.totalSentAmount || 0)}
            </div>
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
              {(summary?.netBalance || 0) >= 0 ? (
                <span style={{ color: 'var(--income)' }}>+{formatMoney(summary?.netBalance || 0)}</span>
              ) : (
                <span style={{ color: 'var(--expense)' }}>-{formatMoney(Math.abs(summary?.netBalance || 0))}</span>
              )}
            </div>
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--fg-muted)', marginTop: 8, fontWeight: 500 }}>
            {(summary?.netBalance || 0) >= 0 ? '👍 받은 금액이 더 많아요' : '💸 보낸 금액이 더 많아요'}
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
              {summary?.upcomingCount || 0}<span style={{ fontSize: '1.2rem', fontWeight: 600, marginLeft: 2 }}>건</span>
            </div>
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--fg-muted)', marginTop: 8, fontWeight: 500 }}>
            챙겨야 할 예정된 일정
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        {/* HTML5 Canvas 월별 수입/지출 비교 차트 */}
        <div className="card">
          <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: '1.18rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={20} style={{ color: 'var(--primary)' }} /> 최근 6개월 월별 입출 추이
          </h2>
          <MonthlyBarChart data={summary?.monthly || []} height={250} />
        </div>

        {/* 경조사 종류별 지출 분포 */}
        <div className="card">
          <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: '1.18rem', fontWeight: 800 }}>
            종류별 보낸 경조사비 비중
          </h2>
          <div>
            {(!summary?.categories || summary.categories.every((c) => c.amount === 0)) ? (
              <p className="table-empty">아직 지출 통계 데이터가 없습니다.</p>
            ) : (
              <ul className="list">
                {summary.categories.map((cat, idx) => {
                  const percent = summary.totalSentAmount > 0
                    ? Math.round((cat.amount / summary.totalSentAmount) * 100)
                    : 0;
                  return (
                    <li key={cat.name} style={{ padding: '14px 0', borderBottom: '1px solid var(--border-light)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: '1.3rem', width: 36, height: 36, borderRadius: 10, background: 'var(--bg-sunken)', display: 'grid', placeItems: 'center' }}>
                            {cat.icon}
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>{cat.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>{cat.count}건의 기록</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--expense)' }}>{formatMoney(cat.amount)}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', fontWeight: 600 }}>{percent}%</div>
                        </div>
                      </div>
                      {/* 미니 프로그레스 바 */}
                      <div style={{ height: 6, width: '100%', background: 'var(--bg-sunken)', borderRadius: 9999, overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, Math.max(0, percent))}%`,
                            background: 'var(--expense)',
                            borderRadius: 9999,
                            transition: 'width 0.4s var(--ease)',
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
  );
}
