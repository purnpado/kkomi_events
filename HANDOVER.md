# HANDOVER.md — 인수인계 문서

> 다른 컴퓨터나 다른 AI 에이전트가 이어서 작업할 때 **가장 먼저 읽는 문서**입니다.
> 작업이 끝날 때마다 반드시 갱신합니다.

- 마지막 갱신: 2026-10-23
- 현재 버전: 0.1.0 (미배포, 🚫 릴리즈 금지 — 사용자 요청 시에만)
- 현재 단계: **주요 핵심 기능 구현 완료 (대시보드 / 나의 경조사 / 타인 경조사 / 사람별 매칭 / 맞춤 항목 관리 UI / 엑셀 입출력 / 인쇄·PDF 출력 / 자동 백업)**

---

## 1. 프로젝트 요약
경조사비 받은 내역(나의 경조사)과 보낸 내역(타인의 경조사)을 정리하고 사람별로 맞춰 보는 윈도우 단독 프로그램.
- 실행 파일: `꼬미경조사.exe` (Wails v2 + React + Radix UI + Vanilla CSS + HTML5 Canvas 직접 그리기 + SQLite)
- 프리텐다드(Pretendard Variable) 폰트 정적 에셋으로 완전 임베딩 (100% 오프라인 지원)
- 모든 파일 경로는 `os.Executable()` 기준 절대 경로(`internal/core/paths`)로 작동 (바로가기 실행 안전)
- 개인정보 보호: `.gitignore`에 `data/`, `backup/`, `logs/`, `*.db` 등 제외
- 전체 기획: [docs/기획안.md](docs/기획안.md) / 규칙: [AGENTS.md](AGENTS.md) / 이벤트: [docs/이벤트목록.md](docs/이벤트목록.md)

---

## 2. 이어서 작업하는 방법 (새 PC 기준)
```powershell
git clone https://gitea.gguk.link/purnpadosori/kkomi-events.git "kkomi events"
cd "kkomi events"
# 사전 준비: Go 1.23+, Node.js 20+, Wails v2 CLI (go install github.com/wailsapp/wails/v2/cmd/wails@latest)
cd frontend; npm install; cd ..
go test ./internal/...
wails build          # 결과물: build/bin/꼬미경조사.exe
```
- Gitea 원격 저장소: `https://gitea.gguk.link/purnpadosori/kkomi-events.git` (main 브랜치)
- 인증: Windows 자격 증명 관리자(Git Credential Manager)에 저장된 `purnpadosori` 계정 사용

---

## 3. 구현 완료된 모듈 및 기능 목록

| 모듈 | 설명 | 주요 기능 |
|---|---|---|
| `core` | 이벤트 버스, 절대 경로, 순수 Go SQLite, 마이그레이션 | `eventbus.Bus`, `paths.Resolve()`, `db.Migrate()`, `module.Registry` |
| `dashboard` | 현황 요약 및 HTML5 Canvas 통계 차트 | 총 수입/지출/차액 요약, 최근 6개월 월별 수입/지출 비교 Canvas 막대 그래프, 종류별 지출 비중 |
| `eventtype` | 경조사 종류(탭) 관리 | 탭 추가, 이름 변경, 아이콘 지정, 순서 변경, 숨기기, 삭제 |
| `myevent` | 나의 경조사 행사 및 축의/부의금 받은 내역 | 행사 CRUD(날짜, 장소, 주인공), 받은 내역 CRUD, 답례 완료 토글 체크, 비고란 |
| `sent` | 타인의 경조사 보낸 내역 (지출) | 상대방 이름, 전화번호, 경조사 종류(탭과 공유), 날짜, 금액, 지출 수단, 참석 여부, 비고란 |
| `matching` | 사람별 경조사비 매칭 및 교차 분석 ⭐ | 이름+전화번호 매칭, 갚을 차례/받을 차례/균형 자동 판정, 타임라인 기록 일지, 타인 경조사 입력 시 낸 금액 자동 힌트 표시 |
| `customfield` | 사용자 정의 추가 항목 관리 | 각 메뉴별 원하는 추가 항목(텍스트, 숫자, 날짜, 체크박스) 생성 및 값 저장, 모달 관리 UI, 테이블 동적 열 표시 |
| `excelio` | 엑셀 입출력 (`excelize/v2`) | 나의 경조사/보낸 내역 엑셀 내보내기, 대량 등록 표준 서식 다운로드, 엑셀 파일 대량 가져오기(트랜잭션) |
| `print` | 인쇄 및 PDF 서식 지원 | `@media print` 방명록 및 장부 인쇄 최적화 서식, 원클릭 인쇄/PDF 저장 버튼 |
| `backup` | 데이터베이스 자동 및 수동 백업 | 프로그램 종료 시 자동 백업, 수동 백업 버튼, 최근 30개 보관 후 오래된 백업 정리 |
| `settings` | 프로그램 설정 | 라이트/다크 모드 전환, 혼자 사용/함께 사용(공동 사용 모드: 손님 구분 활성화), 글자 크기(1.0x~1.2x) 조절 |
| `system` | 시스템 상태 및 네비게이션 | 버전, DB 연결 상태, 저장 경로 안내, 이벤트 테스트 |
| `AmountInput` | 금액 전용 스마트 입력기 | 천 단위 콤마 포맷, 3만/5만/10만/20만 빠른 칩 버튼, 한글 금액("오만원") 실시간 표기 |

---

## 4. 다음 진행 작업 (사용자 요청 시 진행)
- [x] 프리텐다드(Pretendard Variable) 폰트 정적 번들링 적용
- [x] 엑셀 가져오기/내보내기 (`excelize` 라이브러리 연동)
- [x] 인쇄 / PDF 서식 출력 (방명록 형태 출력용 CSS)
- [ ] 사용자 제공 로고 및 아이콘 적용 (사용자가 이미지를 줄 경우 `build/appicon.png` 교체 후 재빌드)
- [ ] 사용자가 명시적으로 요청 시에만 Gitea 릴리즈 생성 (🚫 그 전까지는 릴리즈 금지)

---

## 5. 알려진 주의사항
- Wails 단독 실행 파일은 `build/bin/꼬미경조사.exe` 입니다.
- DB 파일은 `build/bin/data/kkomi.db`에 자동 생성되며, 절대 Git에 커밋되지 않습니다.
