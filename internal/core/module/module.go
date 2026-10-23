// Package module 은 모든 기능 모듈이 지켜야 할 약속(인터페이스)과
// 모듈을 등록·초기화하는 등록소(Registry)를 정의합니다.
//
// 새 기능을 만들 때:
//  1. internal/modules/<이름>/ 폴더를 만든다
//  2. Module 인터페이스를 구현한다 (Name, Migrations, Init)
//  3. 화면에서 부를 함수가 있으면 Bindable 을 구현한다
//  4. main.go 의 모듈 목록에 한 줄 추가한다
package module

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"

	"kkomi-events/internal/core/db"
	"kkomi-events/internal/core/eventbus"
	"kkomi-events/internal/core/paths"
)

// Context 는 모듈이 사용할 수 있는 공용 도구 모음입니다.
type Context struct {
	DB    *sql.DB
	Bus   *eventbus.Bus
	Paths *paths.Paths
	Log   *slog.Logger
}

// Module 은 모든 기능 모듈이 구현해야 하는 기본 인터페이스입니다.
type Module interface {
	Name() string                // 모듈 이름 (이벤트 접두사로도 사용)
	Migrations() []db.Migration  // 이 모듈의 테이블 생성/변경 SQL
	Init(c *Context) error       // 초기화 (이벤트 구독 등)
}

// Bindable 은 화면(프론트엔드)에서 호출할 함수를 가진 모듈이 구현합니다.
type Bindable interface {
	Binding() any
}

// Starter 는 창이 뜬 뒤 실행할 작업이 있는 모듈이 구현합니다.
type Starter interface {
	OnStartup(ctx context.Context)
}

// Stopper 는 프로그램 종료 시 정리할 작업이 있는 모듈이 구현합니다.
type Stopper interface {
	OnShutdown()
}

// Registry 는 등록된 모듈 목록을 관리합니다.
type Registry struct {
	modules []Module
}

// NewRegistry 는 모듈 목록으로 등록소를 만듭니다.
func NewRegistry(mods ...Module) *Registry {
	return &Registry{modules: mods}
}

// Names 는 등록된 모듈 이름 목록입니다.
func (r *Registry) Names() []string {
	names := make([]string, 0, len(r.modules))
	for _, m := range r.modules {
		names = append(names, m.Name())
	}
	return names
}

// Setup 은 모든 모듈의 마이그레이션을 실행한 뒤 모듈을 초기화합니다.
func (r *Registry) Setup(c *Context) error {
	var migs []db.Migration
	for _, m := range r.modules {
		for _, mg := range m.Migrations() {
			mg.Module = m.Name()
			migs = append(migs, mg)
		}
	}
	if err := db.Migrate(c.DB, migs); err != nil {
		return err
	}
	for _, m := range r.modules {
		if err := m.Init(c); err != nil {
			return fmt.Errorf("모듈 초기화 실패 [%s]: %w", m.Name(), err)
		}
		c.Log.Info("모듈 준비 완료", "module", m.Name())
	}
	return nil
}

// Bindings 는 화면에 연결할 객체 목록입니다.
func (r *Registry) Bindings() []any {
	var list []any
	for _, m := range r.modules {
		if b, ok := m.(Bindable); ok {
			list = append(list, b.Binding())
		}
	}
	return list
}

// Startup 은 창이 뜬 뒤 각 모듈의 OnStartup 을 호출합니다.
func (r *Registry) Startup(ctx context.Context) {
	for _, m := range r.modules {
		if s, ok := m.(Starter); ok {
			s.OnStartup(ctx)
		}
	}
}

// Shutdown 은 종료 시 역순으로 OnShutdown 을 호출합니다.
func (r *Registry) Shutdown() {
	for i := len(r.modules) - 1; i >= 0; i-- {
		if s, ok := r.modules[i].(Stopper); ok {
			s.OnShutdown()
		}
	}
}
