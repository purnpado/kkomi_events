import { api } from './api';

/**
 * 구글 캘린더 웹 새 일정 등록 페이지를 외부 브라우저로 열어줍니다.
 * @param {Object} options
 * @param {string} options.title 일정 제목 (예: '[결혼식] 홍길동 결혼식')
 * @param {string} options.startDate 일정 날짜 (YYYY-MM-DD)
 * @param {string} [options.location] 장소 (예: '서울 강남구 아펠가모 2층')
 * @param {string} [options.details] 메모 및 세부 내용
 */
export function openGoogleCalendarAdd({ title, startDate, location = '', details = '' }) {
  if (!startDate) return;

  const cleanStart = startDate.replace(/[^0-9]/g, '').slice(0, 8);
  if (cleanStart.length < 8) return;

  // 구글 캘린더 종일(All-day) 일정 표준 규칙: dates=시작일/종료익일
  let cleanEnd = cleanStart;
  try {
    const parts = [
      cleanStart.slice(0, 4),
      cleanStart.slice(4, 6),
      cleanStart.slice(6, 8),
    ];
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    cleanEnd = `${y}${m}${day}`;
  } catch (e) {
    cleanEnd = cleanStart;
  }

  const queryParams = [
    `action=TEMPLATE`,
    `text=${encodeURIComponent(title || '경조사 일정')}`,
    `dates=${cleanStart}/${cleanEnd}`,
  ];

  if (location && location.trim()) {
    queryParams.push(`location=${encodeURIComponent(location.trim())}`);
  }

  const descLines = [
    details ? details.trim() : '',
    '',
    '🌸 꼬미경조사에서 등록된 일정입니다.',
  ].filter(Boolean).join('\n');

  queryParams.push(`details=${encodeURIComponent(descLines)}`);

  const fullUrl = `https://calendar.google.com/calendar/render?${queryParams.join('&')}`;

  // Wails 브라우저 오픈 API 호출
  api.calendar.openUrl(fullUrl);
}
