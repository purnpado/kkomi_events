package main

import (
	"context"
	"database/sql"
	"io"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"kkomi-events/internal/core/db"
	"kkomi-events/internal/core/eventbus"
	"kkomi-events/internal/core/module"
	"kkomi-events/internal/core/paths"
)

// FrontendEventName 은 Go 이벤트 버스의 모든 이벤트를 화면으로 전달할 때 쓰는 Wails 이벤트 이름입니다.
const FrontendEventName = "kkomi:event"

// teeWriter 는 로그를 파일에 쓰고, 콘솔이 있으면 콘솔에도 씁니다. (콘솔 오류는 무시)
type teeWriter struct {
	file    io.Writer
	console io.Writer
}

func (t teeWriter) Write(b []byte) (int, error) {
	_, _ = t.console.Write(b)
	return t.file.Write(b)
}

// App 은 프로그램 전체를 묶는 뼈대입니다.
// 경로 계산 → 로그 → DB → 이벤트 버스 → 모듈 등록 순서로 준비합니다.
type App struct {
	ctx      context.Context
	paths    *paths.Paths
	log      *slog.Logger
	logFile  *os.File
	db       *sql.DB
	bus      *eventbus.Bus
	registry *module.Registry
}

// Bootstrap 은 창을 띄우기 전에 프로그램을 준비합니다.
func (a *App) Bootstrap(reg *module.Registry) error {
	a.registry = reg

	p, err := paths.Resolve()
	if err != nil {
		return err
	}
	a.paths = p

	// 로그: logs/kkomi.log 파일 (+ 콘솔이 있으면 콘솔에도)
	// 주의: 윈도우 GUI 실행 시 콘솔(stdout)이 없으므로 io.MultiWriter 를 쓰면
	// 콘솔 쓰기 실패로 파일까지 기록이 멈춥니다. 그래서 콘솔 오류는 무시합니다.
	var out io.Writer = os.Stdout
	if f, err := os.OpenFile(filepath.Join(p.LogDir, "kkomi.log"),
		os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644); err == nil {
		a.logFile = f
		out = teeWriter{file: f, console: os.Stdout}
	}
	a.log = slog.New(slog.NewTextHandler(out, nil))
	a.log.Info("프로그램 시작", "appDir", p.AppDir)

	conn, err := db.Open(p.DBFile)
	if err != nil {
		return err
	}
	a.db = conn
	a.bus = eventbus.New(a.log)

	return reg.Setup(&module.Context{DB: conn, Bus: a.bus, Paths: p, Log: a.log})
}

// startup 은 창이 뜬 직후 Wails 가 호출합니다.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// Go 이벤트 버스의 모든 이벤트를 화면(프론트 이벤트 버스)으로 전달
	if a.bus != nil {
		a.bus.Subscribe("*", func(e eventbus.Event) {
			runtime.EventsEmit(a.ctx, FrontendEventName, e)
		})
	}
	if a.registry != nil {
		a.registry.Startup(ctx)
	}
}

// shutdown 은 프로그램 종료 시 Wails 가 호출합니다.
func (a *App) shutdown(ctx context.Context) {
	if a.registry != nil {
		a.registry.Shutdown()
	}
	if a.db != nil {
		a.db.Close()
	}
	if a.log != nil {
		a.log.Info("프로그램 종료")
	}
	if a.logFile != nil {
		a.logFile.Close()
	}
}
