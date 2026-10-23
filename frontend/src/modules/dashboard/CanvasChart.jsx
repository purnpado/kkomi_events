import React, { useEffect, useRef } from 'react';
import { formatMoney } from '../../core/format';

/**
 * HTML5 Canvas 2D 컨텍스트로 직접 그리는 경조사비 월별 수입/지출 비교 막대 차트
 */
export function MonthlyBarChart({ data = [], height = 240 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const h = canvas.height;

    // 캔버스 초기화
    ctx.clearRect(0, 0, width, h);

    if (!data || data.length === 0) {
      ctx.fillStyle = '#888';
      ctx.font = '14px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('표시할 통계 데이터가 없습니다.', width / 2, h / 2);
      return;
    }

    if (!data || data.length === 0) {
      ctx.fillStyle = '#888';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('월별 데이터가 없습니다.', width / 2, h / 2);
      return;
    }

    let maxVal = 100000;
    data.forEach((d) => {
      const rec = Number(d.receivedAmount || d.received || 0);
      const snt = Number(d.sentAmount || d.sent || 0);
      if (rec > maxVal) maxVal = rec;
      if (snt > maxVal) maxVal = snt;
    });

    const paddingLeft = 45;
    const paddingRight = 20;
    const paddingBottom = 40;
    const paddingTop = 30;

    const chartWidth = Math.max(10, width - paddingLeft - paddingRight);
    const chartHeight = Math.max(10, h - paddingTop - paddingBottom);

    // 배경 눈금선
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = paddingTop + (chartHeight / 3) * i;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();

      const labelVal = Math.round((maxVal * (3 - i)) / 3);
      ctx.fillStyle = '#888';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(labelVal >= 10000 ? `${Math.round(labelVal / 10000)}만` : `${labelVal}`, paddingLeft - 8, y + 4);
    }

    const groupWidth = chartWidth / data.length;
    const barWidth = Math.min(groupWidth * 0.28, 28);

    data.forEach((d, idx) => {
      const groupCenterX = paddingLeft + groupWidth * idx + groupWidth / 2;
      const rec = Number(d.receivedAmount || d.received || 0);
      const snt = Number(d.sentAmount || d.sent || 0);

      // 1. 받은 돈 막대 (초록/수입)
      const rBarHeight = Math.max(0, (rec / maxVal) * chartHeight);
      const rBarX = groupCenterX - barWidth - 3;
      const rBarY = paddingTop + chartHeight - rBarHeight;

      if (rBarHeight > 0 && isFinite(rBarY)) {
        const gradIncome = ctx.createLinearGradient(0, rBarY, 0, rBarY + rBarHeight);
        gradIncome.addColorStop(0, '#00B06B');
        gradIncome.addColorStop(1, '#00965b');
        ctx.fillStyle = gradIncome;
        roundRect(ctx, rBarX, rBarY, barWidth, rBarHeight, 6);
      }

      // 2. 보낸 돈 막대 (토스 코랄 레드/지출)
      const sBarHeight = Math.max(0, (snt / maxVal) * chartHeight);
      const sBarX = groupCenterX + 3;
      const sBarY = paddingTop + chartHeight - sBarHeight;

      if (sBarHeight > 0 && isFinite(sBarY)) {
        const gradExpense = ctx.createLinearGradient(0, sBarY, 0, sBarY + sBarHeight);
        gradExpense.addColorStop(0, '#F04452');
        gradExpense.addColorStop(1, '#d6303e');
        ctx.fillStyle = gradExpense;
        roundRect(ctx, sBarX, sBarY, barWidth, sBarHeight, 6);
      }

      // 월 레이블
      ctx.fillStyle = '#8b95a1';
      ctx.font = '600 12px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.month || '', groupCenterX, h - 14);
    });
  }, [data, height]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14, marginBottom: 12, fontSize: '0.85rem', fontWeight: 600 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#00B06B', background: '#e6f7f0', padding: '3px 10px', borderRadius: 9999 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00B06B', display: 'inline-block' }} />
          받은 돈 (수입)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#F04452', background: '#feecee', padding: '3px 10px', borderRadius: 9999 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F04452', display: 'inline-block' }} />
          보낸 돈 (지출)
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={680}
        height={height}
        style={{ width: '100%', height, display: 'block' }}
      />
    </div>
  );
}

/** 모서리가 둥근 사각형 헬퍼 */
function roundRect(ctx, x, y, width, height, radius) {
  if (height <= 0) return;
  const r = Math.min(radius, height / 2, width / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.closePath();
  ctx.fill();
}
