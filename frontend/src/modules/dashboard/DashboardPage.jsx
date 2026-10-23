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
    <>
      <header className="page-header">
        <h1 className="page-title">경조사비 대시보드</h1>
        <p className="page-desc">받은 경조사비와 보낸 경조사비의 전반적인 입출 현황과 통계를 한눈에 확인합니다.</p>
      </header>

      {/* 핵심 4대 지표 카드 */}
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        {/* 총 받은 돈 */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">총 받은 경조사비</span>
            <ArrowDownLeft size={18} style={{ color: 'var(--income)' }} />
          </div>
          <div className="stat-value" style={{ color: 'var(--income)' }}>
            {formatMoney(summary?.totalReceivedAmount || 0)}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginTop: 4 }}>
            총 {summary?.totalReceivedCount || 0}건 입금
          </div>
        </div>

        {/* 총 보낸 돈 */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">총 보낸 경조사비</span>
            <ArrowUpRight size={18} style={{ color: 'var(--expense)' }} />
          </div>
          <div className="stat-value" style={{ color: 'var(--expense)' }}>
            {formatMoney(summary?.totalSentAmount || 0)}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginTop: 4 }}>
            총 {summary?.totalSentCount || 0}건 지출
          </div>
        </div>

        {/* 순수 차액 */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">수지 균형 (차액)</span>
            <Scale size={18} style={{ color: 'var(--brand-500)' }} />
          </div>
          <div className="stat-value">
            {(summary?.netBalance || 0) >= 0 ? (
              <span style={{ color: 'var(--income)' }}>+{formatMoney(summary?.netBalance || 0)}</span>
            ) : (
              <span style={{ color: 'var(--expense)' }}>-{formatMoney(Math.abs(summary?.netBalance || 0))}</span>
            )}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginTop: 4 }}>
            {(summary?.netBalance || 0) >= 0 ? '받은 금액이 더 많음' : '보낸 금액이 더 많음'}
          </div>
        </div>

        {/* 다가오는 일정 */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">다가오는 경조사</span>
            <Calendar size={18} style={{ color: 'var(--info)' }} />
          </div>
          <div className="stat-value" style={{ color: 'var(--info)' }}>
            {summary?.upcomingCount || 0}건
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginTop: 4 }}>
            예정된 일정
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        {/* HTML5 Canvas 월별 수입/지출 비교 차트 */}
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} /> 최근 6개월 월별 입출 추이 (Canvas 차트)
          </h2>
          <MonthlyBarChart data={summary?.monthly || []} height={250} />
        </div>

        {/* 경조사 종류별 지출 분포 */}
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: '1.15rem' }}>
            종류별 보낸 경조사비 비중
          </h2>
          <div style={{ marginTop: 12 }}>
            {(!summary?.categories || summary.categories.every((c) => c.amount === 0)) ? (
              <p className="table-empty">아직 지출 통계 데이터가 없습니다.</p>
            ) : (
              <ul className="list">
                {summary.categories.map((cat, idx) => {
                  const percent = summary.totalSentAmount > 0
                    ? Math.round((cat.amount / summary.totalSentAmount) * 100)
                    : 0;
                  return (
                    <li key={cat.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '1.2rem' }}>{cat.icon}</span>
                        <div>
                          <strong>{cat.name}</strong>
                          <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>{cat.count}건</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ color: 'var(--expense)' }}>{formatMoney(cat.amount)}</strong>
                        <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>{percent}%</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
