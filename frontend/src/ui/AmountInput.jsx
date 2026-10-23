import React from 'react';
import { numberToKorean, formatNumber } from '../core/format';

/**
 * 경조사비 금액 전용 입력 컴포넌트
 * - 숫자만 입력 가능 (천 단위 콤마 자동 서식)
 * - 하단에 한글 금액 표기 (예: "50,000원 -> 5만원")
 * - 3만, 5만, 10만, 20만 원 빠른 추가 버튼
 */
export default function AmountInput({ value, onChange, placeholder = '금액 입력', id, autoFocus }) {
  // 숫자만 추출
  const numericVal = typeof value === 'number' ? value : parseInt(String(value || '').replace(/[^0-9]/g, ''), 10) || 0;

  const handleChange = (e) => {
    let raw = e.target.value.replace(/[^0-9]/g, '');
    let num = parseInt(raw, 10) || 0;
    // 5만 원 단위 편의: 한 자리 숫자 1~9 입력 시 만원 단위로 빠른 권장 가능하도록
    onChange(num);
  };

  const handleQuickAdd = (add) => {
    onChange((numericVal || 0) + add);
  };

  const handleQuickSet = (setVal) => {
    onChange(setVal);
  };

  return (
    <div className="amount-input-group">
      <div className="amount-field-wrapper">
        <input
          id={id}
          type="text"
          className="input-text amount-field"
          value={numericVal > 0 ? formatNumber(numericVal) : ''}
          placeholder={placeholder}
          onChange={handleChange}
          autoFocus={autoFocus}
          autoComplete="off"
        />
        <span className="amount-unit">원</span>
      </div>

      {numericVal > 0 && (
        <div className="amount-korean-hint">
          {numberToKorean(numericVal)}
        </div>
      )}

      <div className="quick-amount-buttons">
        <button type="button" className="btn-chip" onClick={() => handleQuickSet(30000)}>
          3만
        </button>
        <button type="button" className="btn-chip" onClick={() => handleQuickSet(50000)}>
          5만
        </button>
        <button type="button" className="btn-chip" onClick={() => handleQuickSet(100000)}>
          10만
        </button>
        <button type="button" className="btn-chip" onClick={() => handleQuickSet(200000)}>
          20만
        </button>
        <button type="button" className="btn-chip" onClick={() => handleQuickAdd(50000)}>
          +5만
        </button>
        <button type="button" className="btn-chip" onClick={() => handleQuickAdd(100000)}>
          +10만
        </button>
        {numericVal > 0 && (
          <button type="button" className="btn-chip btn-chip-clear" onClick={() => onChange(0)}>
            초기화
          </button>
        )}
      </div>
    </div>
  );
}
