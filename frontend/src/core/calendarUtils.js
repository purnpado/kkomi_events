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

  const startYear = Number(cleanStart.slice(0, 4));
  const startMonth = Number(cleanStart.slice(4, 6));
  const startDay = Number(cleanStart.slice(6, 8));
  if (startYear < 1900 || startMonth < 1 || startMonth > 12 || startDay < 1 || startDay > 31) {
    return; // 유효하지 않거나 미상인 날짜는 구글 캘린더 등록 제외
  }

  // 구글 캘린더 종일(All-day) 일정 표준 규칙: dates=시작일/종료익일
  let cleanEnd = cleanStart;
  try {
    const d = new Date(startYear, startMonth - 1, startDay);
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

/**
 * 경조사 일정 목록을 표준 iCalendar(.ics) 파일로 일괄 다운로드합니다.
 * 구글 캘린더, 네이버 캘린더, 아웃룩, 갤럭시/아이폰 캘린더에 한 번에 등록할 수 있습니다.
 * @param {string} filename 저장할 파일명
 * @param {Array} events 일정 객체 배열
 */
export function downloadEventsAsIcs(filename, events) {
  if (!events || events.length === 0) return;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//꼬미경조사//KKOMI EVENTS//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:꼬미경조사 타인 경조사 일정',
  ];

  events.forEach((ev, idx) => {
    if (!ev.eventDate) return;
    const cleanDate = ev.eventDate.replace(/[^0-9]/g, '').slice(0, 8);
    if (cleanDate.length < 8) return;

    const evYear = Number(cleanDate.slice(0, 4));
    const evMonth = Number(cleanDate.slice(4, 6));
    const evDay = Number(cleanDate.slice(6, 8));
    if (evYear < 1900 || evMonth < 1 || evMonth > 12 || evDay < 1 || evDay > 31) {
      return; // 연도나 날짜가 미상인 항목은 캘린더(.ics) 내보내기에서 안전하게 제외
    }

    let cleanEnd = cleanDate;
    try {
      const d = new Date(evYear, evMonth - 1, evDay);
      d.setDate(d.getDate() + 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      cleanEnd = `${y}${m}${day}`;
    } catch {
      cleanEnd = cleanDate;
    }

    const title = ev.title || `[${ev.eventTypeName || ev.eventTypeIcon || '경조사'}] ${ev.name}`;
    const desc = [
      ev.relationship ? `관계: ${ev.relationship}` : '',
      ev.amount ? `금액: ${Number(ev.amount).toLocaleString()}원` : '',
      ev.notes ? `비고: ${ev.notes}` : '',
      '꼬미경조사에서 내보낸 일정',
    ].filter(Boolean).join('\\n');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:kkomi-sent-${Date.now()}-${idx}@kkomi.local`);
    lines.push(`DTSTAMP:${cleanDate}T000000Z`);
    lines.push(`DTSTART;VALUE=DATE:${cleanDate}`);
    lines.push(`DTEND;VALUE=DATE:${cleanEnd}`);
    lines.push(`SUMMARY:${title}`);
    lines.push(`DESCRIPTION:${desc}`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');

  const icsContent = lines.join('\r\n');
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename || '꼬미경조사_타인경조사_일정.ics');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

