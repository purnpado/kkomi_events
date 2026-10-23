# 꼬미경조사

경조사비 **받은 내역(나의 경조사)** 과 **보낸 내역(타인의 경조사)** 을 정리하고,
사람별로 주고받은 기록을 맞춰 보여주는 **윈도우용 단독 실행 프로그램**입니다.

- 실행 파일: `꼬미경조사.exe`
- 설치 필요 없음, 인터넷 없이 동작 (업데이트 확인만 인터넷 사용)
- 데이터는 실행 파일 옆 `data/kkomi.db` 에 저장 (처음 실행할 때 자동 생성)

## [작업 수칙]

1. **100% 한국어**: 모든 대답, 설명, 코드 주석, 커밋 메시지는 반드시 한국어로 작성한다.
2. **모듈화**: 메뉴·기능 하나 = 모듈 하나. 백엔드 `internal/modules/<이름>`, 화면 `frontend/src/modules/<이름>` 에 같은 이름으로 만든다.
3. **이벤트 기반**: 모듈끼리 직접 호출하지 않는다. 이벤트 버스(`<모듈>.<동작>`)로만 소통한다. 새 이벤트는 `docs/이벤트목록.md` 에 기록한다.
4. **절대 경로**: 파일 위치는 항상 `os.Executable()` 기준(`internal/core/paths`)으로 계산하고 `filepath.Join` 을 쓴다. (한글·공백 경로 대응)
5. **개인정보 보호**: `*.db`, `*.sqlite`, `data/`, `backup/`, `logs/` 는 절대 커밋하지 않는다.
6. **릴리즈 금지**: 사용자가 "릴리즈해 줘"라고 요청하기 전에는 Gitea 릴리즈를 만들지 않는다. 빌드는 로컬에서만 한다.
7. **인수인계**: 작업이 끝날 때마다 `HANDOVER.md` 와 `CHANGELOG.md` 를 갱신하고 커밋·푸시한다.

## 개발 환경

| 도구 | 버전 |
|---|---|
| Go | 1.26 이상 |
| Node.js | 20 이상 |
| Wails CLI | v2.15 이상 (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`) |

## 명령어

```powershell
wails dev                 # 개발 모드 실행 (화면 수정 즉시 반영)
wails build -clean        # 배포용 빌드 → build/bin/꼬미경조사.exe
go test ./internal/...    # 백엔드 테스트
```

## 문서

- [AGENTS.md](AGENTS.md) – 에이전트(개발자) 작업 규칙
- [HANDOVER.md](HANDOVER.md) – 현재 진행 상황과 다음 할 일
- [CHANGELOG.md](CHANGELOG.md) – 변경 이력
- [docs/기획안.md](docs/기획안.md) – 전체 기획
- [docs/이벤트목록.md](docs/이벤트목록.md) – 이벤트 이름과 데이터
