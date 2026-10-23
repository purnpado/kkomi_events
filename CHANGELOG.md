# 변경 이력

## [0.1.0] - 2026-10-23 (개발 중, 미배포)
### 추가
- Wails + Vite + React 프로젝트 생성, 실행 파일 이름 `꼬미경조사.exe`
- 실행 파일 기준 절대 경로 계산 (`internal/core/paths`)
- 이벤트 버스 (Go `internal/core/eventbus`, 화면 `core/eventBus.js`) 및 Go → 화면 자동 전달
- 모듈 등록소와 모듈별 DB 마이그레이션 (`internal/core/module`, `internal/core/db`)
- SQLite DB 자동 생성 (`data/kkomi.db`), 한글·공백 경로 테스트
- 모듈: system(시스템 정보), settings(설정)
- 중복 실행 방지, 로그 파일(`logs/kkomi.log`)
- 문서: README, AGENTS, HANDOVER, 기획안, 이벤트 목록
