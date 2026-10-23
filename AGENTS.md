# AGENTS.md — 에이전트 작업 규칙

이 저장소에서 작업하는 모든 AI 에이전트/개발자는 아래 규칙을 따른다.
**작업을 시작하기 전에 반드시 `HANDOVER.md` 를 먼저 읽는다.**

## 1. 사용자 정보
- 사용자는 코딩을 모르는 현직 교사다. 환경 설정·코드 작성·빌드·버그 수정은 에이전트가 모두 직접 한다.
- 결과는 쉬운 한국어로, 화면 캡처와 함께 보고한다.

## 2. 언어
- 대답, 코드 주석, 커밋 메시지, 문서: **100% 한국어**.

## 3. 기술 스택
- 백엔드: Go + Wails v2
- 화면: Vite + React(JavaScript) + Radix UI + 순수 CSS (Tailwind 사용 안 함)
- 그래프: HTML5 Canvas 직접 그리기
- DB: SQLite (`modernc.org/sqlite`, 순수 Go, CGO 불필요)

## 4. 구조 규칙 (중요)
### 모듈
- 백엔드 모듈: `internal/modules/<이름>/` — `module.Module` 인터페이스(Name, Migrations, Init) 구현
  - 화면에서 부를 함수가 있으면 `Binding()` 으로 서비스 구조체를 돌려준다.
  - 등록: `main.go` 의 `module.NewRegistry(...)` 목록에 추가
  - 테이블은 자기 모듈의 `Migrations()` 에서만 만든다. 이미 배포된 마이그레이션은 **수정 금지**, 새 버전을 추가한다.
- 화면 모듈: `frontend/src/modules/<이름>/index.js` 에서 `registerModule({...})`
  - 등록: `frontend/src/modules/index.js` 에 import 추가
  - 백엔드 호출은 `frontend/src/core/api.js` 를 통해서만 한다.

### 이벤트
- 이름 규칙: `<모듈>.<동작>` (예: `received.created`)
- Go: `ctx.Bus.Publish(source, topic, payload)` / `ctx.Bus.Subscribe(pattern, handler)`
- Go 의 모든 이벤트는 Wails 이벤트 `kkomi:event` 로 화면에 자동 전달된다.
- 화면: `useBusEvent(pattern, handler)` 훅 또는 `on()/emit()` (`core/eventBus.js`)
- **모듈끼리 직접 import/호출 금지.** 다른 모듈의 데이터가 바뀌면 이벤트를 듣고 다시 불러온다.
- 새 이벤트를 만들면 `docs/이벤트목록.md` 에 추가한다.

### 경로/보안
- 경로는 `internal/core/paths` (os.Executable 기준) 만 사용. 작업 폴더(cwd) 기준 경로 금지.
- 개인정보(DB, 백업, 로그)는 커밋 금지 (`.gitignore` 확인).
- 금액은 정수(원 단위)로 저장한다.

## 5. Git
- 원격 저장소: `https://gitea.gguk.link/purnpadosori/kkomi-events.git` (브랜치 `main`)
- 인증: Windows 자격 증명 관리자(Git Credential Manager)에 저장된 계정을 사용. 토큰을 코드/로그에 쓰지 않는다.
- 기능 단위로 한국어 커밋 후 푸시.
- 🚫 **사용자가 요청하기 전에는 릴리즈(태그/Gitea Release) 생성 금지.**

## 6. 빌드/확인
```powershell
go test ./internal/...
wails build -clean     # 결과: build/bin/꼬미경조사.exe
```
- 빌드 후 실행해서 화면을 확인하고 캡처로 보고한다.

## 7. 작업 마무리 체크리스트
- [ ] `go test ./internal/...` 통과
- [ ] `wails build -clean` 성공
- [ ] `HANDOVER.md` 갱신 (완료/진행 중/다음 할 일/알려진 문제)
- [ ] `CHANGELOG.md` 갱신
- [ ] 한국어 커밋 + 푸시
