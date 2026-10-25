// Package system 은 프로그램 상태(버전, 경로, DB, 모듈 목록)를 알려주고
// 이벤트 버스가 화면까지 잘 연결되는지 확인하는 모듈입니다.
package system

import (
	"database/sql"
	"os"
	"os/exec"
	"runtime"
	"time"

	"kkomi-events/internal/core/db"
	"kkomi-events/internal/core/eventbus"
	"kkomi-events/internal/core/module"
	"kkomi-events/internal/core/paths"
	"kkomi-events/internal/core/version"
)

// 이벤트 이름
const (
	EventPing = "system.ping"
)

// Info 는 화면에 보여줄 프로그램 상태입니다.
type Info struct {
	AppName    string                `json:"appName"`
	Version    string                `json:"version"`
	Paths      *paths.Paths          `json:"paths"`
	DBReady    bool                  `json:"dbReady"`
	DBSize     int64                 `json:"dbSize"`
	Modules    []string              `json:"modules"`
	Migrations []db.AppliedMigration `json:"migrations"`
	StartedAt  string                `json:"startedAt"`
	InitError  string                `json:"initError"`
}

// Module 은 시스템 모듈입니다.
type Module struct {
	svc *Service
}

// New 는 시스템 모듈을 만듭니다. names 는 등록된 모듈 이름 목록을 돌려주는 함수입니다.
func New(names func() []string) *Module {
	return &Module{svc: &Service{names: names, startedAt: time.Now()}}
}

// Name 은 모듈 이름입니다.
func (m *Module) Name() string { return "system" }

// Migrations 는 없습니다.
func (m *Module) Migrations() []db.Migration { return nil }

// Init 은 공용 도구를 저장합니다.
func (m *Module) Init(c *module.Context) error {
	m.svc.db = c.DB
	m.svc.bus = c.Bus
	m.svc.paths = c.Paths
	return nil
}

// Binding 은 화면에서 호출할 서비스입니다.
func (m *Module) Binding() any { return m.svc }

// SetInitError 는 시작 중 오류가 났을 때 화면에 보여줄 메시지를 저장합니다.
func (m *Module) SetInitError(p *paths.Paths, err error) {
	m.svc.paths = p
	m.svc.initErr = err
}

// Service 는 화면에서 호출하는 시스템 함수 모음입니다.
type Service struct {
	db        *sql.DB
	bus       *eventbus.Bus
	paths     *paths.Paths
	names     func() []string
	startedAt time.Time
	initErr   error
}

// GetInfo 는 현재 프로그램 상태를 돌려줍니다.
func (s *Service) GetInfo() Info {
	info := Info{
		AppName:   version.AppName,
		Version:   version.Version,
		Paths:     s.paths,
		Modules:   s.names(),
		StartedAt: s.startedAt.Format(time.RFC3339),
	}
	if s.initErr != nil {
		info.InitError = s.initErr.Error()
	}
	if s.db != nil && s.db.Ping() == nil {
		info.DBReady = true
		info.Migrations, _ = db.Applied(s.db)
	}
	if s.paths != nil {
		if st, err := os.Stat(s.paths.DBFile); err == nil {
			info.DBSize = st.Size()
		}
	}
	return info
}

// Ping 은 테스트용 이벤트를 발행합니다. 화면이 이 이벤트를 받으면
// "Go → 이벤트 버스 → 화면" 연결이 정상이라는 뜻입니다.
func (s *Service) Ping(message string) {
	if s.bus != nil {
		s.bus.Publish("system", EventPing, map[string]string{"message": message})
	}
}

// Navigate 는 화면 메뉴를 이동시키는 이벤트를 발행합니다.
func (s *Service) Navigate(moduleID string) {
	if s.bus != nil {
		s.bus.Publish("system", "nav.goto", moduleID)
	}
}

// OpenURL 은 기본 웹 브라우저로 지정된 외부 URL을 엽니다.
func (s *Service) OpenURL(rawURL string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", rawURL)
	case "darwin":
		cmd = exec.Command("open", rawURL)
	default:
		cmd = exec.Command("xdg-open", rawURL)
	}
	return cmd.Start()
}

