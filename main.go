package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"

	"kkomi-events/internal/core/module"
	"kkomi-events/internal/core/paths"
	"kkomi-events/internal/core/version"
	"kkomi-events/internal/modules/backup"
	"kkomi-events/internal/modules/customfield"
	"kkomi-events/internal/modules/dashboard"
	"kkomi-events/internal/modules/eventtype"
	"kkomi-events/internal/modules/matching"
	"kkomi-events/internal/modules/myevent"
	"kkomi-events/internal/modules/sent"
	"kkomi-events/internal/modules/settings"
	"kkomi-events/internal/modules/system"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := &App{}

	// ── 모듈 등록 ─────────────────────────────────────────
	// 새 기능 모듈은 여기 목록에 한 줄만 추가하면 됩니다.
	var reg *module.Registry
	sys := system.New(func() []string { return reg.Names() })
	reg = module.NewRegistry(
		sys,
		settings.New(),
		eventtype.New(),
		myevent.New(),
		sent.New(),
		matching.New(),
		customfield.New(),
		dashboard.New(),
		backup.New(),
	)
	// ────────────────────────────────────────────────────

	bindings := []interface{}{}
	if err := app.Bootstrap(reg); err != nil {
		// 시작 오류가 나도 창은 띄워서 화면에 원인을 보여줍니다.
		p, _ := paths.Resolve()
		sys.SetInitError(p, err)
		if app.log != nil {
			app.log.Error("시작 오류", "error", err)
		}
		bindings = append(bindings, sys.Binding())
	} else {
		for _, b := range reg.Bindings() {
			bindings = append(bindings, b)
		}
	}

	err := wails.Run(&options.App{
		Title:     version.AppName,
		Width:     1280,
		Height:    820,
		MinWidth:  1024,
		MinHeight: 680,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 250, G: 247, B: 242, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		// 프로그램을 두 번 실행해 DB 가 동시에 수정되는 일을 막습니다.
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId: "kkomi-events-3f6b2c1e-single-instance",
		},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
		},
		Bind: bindings,
	})
	if err != nil {
		println("오류:", err.Error())
	}
}
