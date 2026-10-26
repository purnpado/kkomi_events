import React, { useRef, useEffect, useState } from 'react';
import { formatMoney } from '../../core/format';
import { BarChart3 } from 'lucide-react';

/**
 * HTML5 Canvas 기반의 최근 6개월 월별 경조사비 수입/지출 비교 막대 차트
 */
export default function MonthlyChart({ monthly = [] }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(-1);
  const [tooltip, setTooltip] = useState(null);

  // 데이터 정제
  const chartData = (monthly && monthly.length > 0)
    ? monthly
    : [
        { month: '2026-05', receivedAmount: 0, sentAmount: 0 },
        { month: '2026-06', receivedAmount: 0, sentAmount: 0 },
        { month: '2026-07', receivedAmount: 0, sentAmount: 0 },
        { month: '2026-08', receivedAmount: 0, sentAmount: 0 },
        { month: '2026-09', receivedAmount: 0, sentAmount: 0 },
        { month: '2026-10', receivedAmount: 0, sentAmount: 0 },
      ];

  // 최대 금액 계산 (최소 10만원 기준 스케일)
  const maxVal = Math.max(
    100000,
    ...chartData.map((d) => Math.max(d.receivedAmount || 0, d.sentAmount || 0))
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 고해상도(레티나) 처리
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = 220;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const padding = { top: 25, right: 20, bottom: 35, left: 20 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // 1. 수평 가이드라인 그리기 (3줄)
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    for (let i = 0; i <= 3; i++) {
      const y = padding.top + (chartHeight / 3) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }
    ctx.setLineDash([]); // 대시 리셋

    // 2. 막대 및 월 라벨 그리기
    const barGroupWidth = chartWidth / chartData.length;
    const singleBarWidth = Math.min(18, barGroupWidth * 0.28);
    const barGap = 4;

    chartData.forEach((item, idx) => {
      const groupCenterX = padding.left + barGroupWidth * idx + barGroupWidth / 2;
      const isHovered = hoverIndex === idx;

      // 호버 배경 하이라이트
      if (isHovered) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
        ctx.beginPath();
        ctx.roundRect(
          padding.left + barGroupWidth * idx + 4,
          padding.top - 5,
          barGroupWidth - 8,
          chartHeight + 10,
          8
        );
        ctx.fill();
      }

      // 월 라벨 (예: "10월")
      const monthPart = item.month.split('-')[1] || '';
      const monthLabel = monthPart ? `${parseInt(monthPart, 10)}월` : item.month;

      ctx.fillStyle = isHovered ? 'var(--primary)' : '#64748b';
      ctx.font = isHovered ? 'bold 12px Pretendard, sans-serif' : '500 12px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(monthLabel, groupCenterX, height - padding.bottom + 10);

      // 받은 돈(수입) 막대
      const recAmount = item.receivedAmount || 0;
      const recHeight = (recAmount / maxVal) * chartHeight;
      const recX = groupCenterX - singleBarWidth - barGap / 2;
      const recY = padding.top + chartHeight - recHeight;

      if (recHeight > 0) {
        ctx.fillStyle = isHovered ? '#059669' : '#10b981';
        ctx.beginPath();
        ctx.roundRect(recX, recY, singleBarWidth, recHeight, [4, 4, 0, 0]);
        ctx.fill();
      } else {
        // 0원일 때 작은 점
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(recX, padding.top + chartHeight - 2, singleBarWidth, 2);
      }

      // 보낸 돈(지출) 막대
      const sentAmount = item.sentAmount || 0;
      const sentHeight = (sentAmount / maxVal) * chartHeight;
      const sentX = groupCenterX + barGap / 2;
      const sentY = padding.top + chartHeight - sentHeight;

      if (sentHeight > 0) {
        ctx.fillStyle = isHovered ? '#dc2626' : '#ef4444';
        ctx.beginPath();
        ctx.roundRect(sentX, sentY, singleBarWidth, sentHeight, [4, 4, 0, 0]);
        ctx.fill();
      } else {
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(sentX, padding.top + chartHeight - 2, singleBarWidth, 2);
      }
    });
  }, [chartData, hoverIndex, maxVal]);

  // 마우스 이동 시 호버 인덱스 및 툴팁 계산
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padding = { top: 25, right: 20, bottom: 35, left: 20 };
    const chartWidth = rect.width - padding.left - padding.right;
    const barGroupWidth = chartWidth / chartData.length;

    if (x >= padding.left && x <= rect.width - padding.right && y >= padding.top && y <= rect.height - padding.bottom) {
      const idx = Math.floor((x - padding.left) / barGroupWidth);
      if (idx >= 0 && idx < chartData.length) {
        setHoverIndex(idx);
        setTooltip({
          x: e.clientX - rect.left,
          y: Math.max(10, y - 60),
          data: chartData[idx],
        });
        return;
      }
    }
    setHoverIndex(-1);
    setTooltip(null);
  };

  const handleMouseLeave = () => {
    setHoverIndex(-1);
    setTooltip(null);
  };

  return (
    <div className="card" style={{ marginBottom: 24, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart3 size={20} style={{ color: 'var(--primary)' }} /> 최근 6개월 경조사비 추이
        </h2>
        {/* 범례 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '0.82rem', fontWeight: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981', display: 'inline-block' }} />
            <span style={{ color: 'var(--fg-muted)' }}>받은 경조사비 (수입)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} />
            <span style={{ color: 'var(--fg-muted)' }}>보낸 경조사비 (지출)</span>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{ position: 'relative', width: '100%', height: 220 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block', cursor: 'pointer' }}
        />

        {/* 툴팁 팝오버 */}
        {tooltip && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(Math.max(10, tooltip.x - 70), (containerRef.current?.offsetWidth || 300) - 150),
              top: tooltip.y,
              background: 'rgba(15, 23, 42, 0.92)',
              color: 'white',
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: '0.8rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              pointerEvents: 'none',
              zIndex: 10,
              minWidth: 140,
              backdropFilter: 'blur(4px)',
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 4, color: '#f8fafc', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: 2 }}>
              {tooltip.data.month}월 경조사비
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: '#a7f3d0' }}>
              <span>받은 돈:</span>
              <span style={{ fontWeight: 700 }}>+{formatMoney(tooltip.data.receivedAmount || 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: '#fca5a5' }}>
              <span>보낸 돈:</span>
              <span style={{ fontWeight: 700 }}>-{formatMoney(tooltip.data.sentAmount || 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4, paddingTop: 3, borderTop: '1px dashed rgba(255,255,255,0.2)', color: '#e2e8f0', fontWeight: 800 }}>
              <span>차액:</span>
              <span>
                {(tooltip.data.receivedAmount || 0) - (tooltip.data.sentAmount || 0) >= 0 ? '+' : '-'}
                {formatMoney(Math.abs((tooltip.data.receivedAmount || 0) - (tooltip.data.sentAmount || 0)))}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
