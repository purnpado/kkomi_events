# HANDOVER.md — 인수인계 문서

> 다른 컴퓨터나 다른 에이전트가 이어서 작업할 때 **가장 먼저 읽는 문서**입니다.
> 작업이 끝날 때마다 반드시 갱신합니다.

- 마지막 갱신: 2026-10-23
- 현재 버전: 0.1.0 (미배포, 🚫 릴리즈 금지 — 사용자 요청 시에만)
- 현재 단계: **1단계 완료** → 다음은 2단계

## 1. 프로젝트 요약
경조사비 받은 내역(나의 경조사)·보낸 내역(타인의 경조사)을 정리하고 사람별로 맞춰 보는 윈도우 단독 프로그램.
전체 기획: [docs/기획안.md](docs/기획안.md) / 규칙: [AGENTS.md](AGENTS.md)

## 2. 이어서 작업하는 방법 (새 PC)
```powershell
git clone https://gitea.gguk.link/purnpadosori/kkomi-events.git "kkomi events"
cd "kkomi events"
# Go 1.26+, Node 20+, Wails CLI 설치 필요
cd frontend; npm install; cd ..
go test ./internal/...
wails build -clean      # → build/bin/꼬미경조사.exe
```
- 첫 푸시 때 Gitea 로그인 창이 뜨면 `purnpadosori` 계정으로 로그인 (Windows 자격 증명에 저장됨)

## 3. 완료된 작업
### 1단계: 기반 구조
- Wails + Vite + React 프로젝트, 실행 파일명 `꼬미경조사.exe` (`wails.json` outputfilename)
- `internal/core/paths`: os.Executable() 기준 절대 경로 → `data/`, `backup/`, `logs/`, `assets/` 자동 생성
- `internal/core/db`: SQLite 연결(WAL, 외래키), 모듈별 마이그레이션(`schema_migrations` 표)
- `internal/core/eventbus`: 발행/구독, 패턴(`*`, `모듈.*`), 구독자 오류 격리
- `internal/core/module`: 모듈 인터페이스와 등록소 (Setup/Bindings/Startup/Shutdown)
- `app.go`: 시작 순서(경로→로그→DB→버스→모듈), Go 이벤트 → Wails `kkomi:event` 로 화면 전달
- 모듈: `system`(상태 정보, 이벤트 테스트), `settings`(키-값 설정, 기본값 저장)
- 화면 core: `eventBus.js`, `registry.js`(메뉴 자동 생성), `api.js`, `hooks.js`(useBusEvent)
- 디자인 토큰(`styles/tokens.css`, 라이트/다크), Pretendard 글꼴(오프라인 번들)
- 중복 실행 방지(SingleInstanceLock), 로그 파일 `logs/kkomi.log`
- 테스트: 이벤트 버스, 한글·공백 경로 DB 생성/마이그레이션

## 4. 다음 할 일 (2단계~)
- [ ] 2단계: Radix UI 설치, 공통 부품(Table, Dialog, Tabs, Toast, AmountInput, Select), 설정 화면(테마/글자 크기/사용 방식)
- [ ] 3단계: eventtype(탭 관리) + myevent(나의 경조사·받은 내역)
- [ ] 4단계: sent(타인 경조사) + person(주소록, 전화번호 정규화)
- [ ] 5단계: matching(사람별 매칭)
- [ ] 6단계: customfield(사용자 항목) + member(공동 사용)
- [ ] 7단계: dashboard, schedule, stats(Canvas)
- [ ] 8단계: trash, undo, auditlog, backup
- [ ] 9단계: excel, print, security, 테마
- [ ] 10단계: updater, 로고/아이콘 교체(사용자 이미지 대기 중), 최종 빌드

## 5. 알려진 문제 / 주의사항
- 윈도우 GUI 실행 시 콘솔이 없으므로 로그는 `teeWriter` 로 파일 우선 기록 (io.MultiWriter 사용 금지)
- Wails 바인딩 이름: `window.go.<패키지>.Service.<함수>` (각 모듈 서비스 구조체 이름은 `Service`)
- `frontend/wailsjs/` 는 빌드 시 자동 생성되지만 커밋해 둔다 (화면 코드가 참조할 수 있도록)
- 로고/아이콘: 사용자가 이미지를 주면 `build/appicon.png` 교체 후 `build/windows/icon.ico` 삭제하고 재빌드
