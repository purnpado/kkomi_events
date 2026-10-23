/**
 * 날짜 및 금액, 전화번호 포맷팅 유틸리티
 */

// 숫자를 천 단위 콤마 포맷으로 변환
export function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString('ko-KR');
}

// 금액을 "50,000원" 형태로 변환
export function formatMoney(num) {
  return `${formatNumber(num)}원`;
}

// 전화번호를 010-1234-5678 형식으로 정규화하여 출력
export function formatPhone(phone) {
  if (!phone) return '-';
  const clean = String(phone).replace(/[^0-9]/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  if (clean.length === 10) {
    if (clean.startsWith('02')) {
      return clean.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
    }
    return clean.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  }
  if (clean.length === 9 && clean.startsWith('02')) {
    return clean.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3');
  }
  return phone;
}

// 전화번호 비교 및 DB 저장을 위한 순수 숫자 정규화
export function normalizePhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/[^0-9]/g, '');
}

// 금액을 알기 쉬운 한글 단위("5만원", "1,000만원")로 표기
export function numberToKorean(val) {
  const num = Number(val);
  if (!num || isNaN(num)) return '';
  if (num === 0) return '0원';

  const units = ['', '만', '억', '조'];
  let result = '';
  let temp = Math.abs(num);
  let unitIdx = 0;

  while (temp > 0) {
    const part = temp % 10000;
    if (part > 0) {
      result = `${part.toLocaleString('ko-KR')}${units[unitIdx]} ` + result;
    }
    temp = Math.floor(temp / 10000);
    unitIdx++;
  }

  return (num < 0 ? '-' : '') + result.trim() + '원';
}

// 10만원 이상 큰 금액일 때 한글 단위를 함께 병행 표기 ("10,000,000원 (1,000만원)")
export function formatMoneyWithKorean(val) {
  const num = Number(val);
  if (!num || isNaN(num) || num === 0) return '0원';
  const moneyStr = formatMoney(num);
  if (Math.abs(num) >= 100000) {
    const krStr = numberToKorean(num);
    return `${moneyStr} (${krStr})`;
  }
  return moneyStr;
}

// 날짜를 YYYY-MM-DD 형태로 포맷
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return dateStr;
  }
}
