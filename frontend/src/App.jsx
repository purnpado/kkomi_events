import { useState } from 'react';
import { getModules } from './core/registry';
import { useBusEvent } from './core/hooks';
import ToastProvider from './ui/Toast';

const SECTION_TITLES = { main: '장부', tools: '도구', system: '시스템' };

export default function App() {
  const modules = getModules().filter((m) => m.Page);
  const [activeId, setActiveId] = useState(modules[0]?.id);
  const active = modules.find((m) => m.id === activeId);
  const sections = ['main', 'tools', 'system'].filter((s) => modules.some((m) => m.section === s));

  // nav.goto 이벤트 수신 시 해당 화면으로 자동 이동
  useBusEvent('nav.goto', (e) => {
    if (e.payload) setActiveId(e.payload);
  });

  // 외부 및 테스트용 네비게이션 함수 노출
  if (typeof window !== 'undefined') {
    window.__kkomiNav = (id) => setActiveId(id);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo" aria-hidden>🎎</div>
          <div>
            <div className="brand-name">꼬미경조사</div>
            <div className="brand-ver">경조사비 장부</div>
          </div>
        </div>
        <nav aria-label="주 메뉴">
          {sections.map((s) => (
            <div key={s}>
              <div className="nav-section-title">{SECTION_TITLES[s]}</div>
              {modules
                .filter((m) => m.section === s)
                .map((m) => (
                  <button
                    key={m.id}
                    id={`nav-${m.id}`}
                    className="nav-item"
                    aria-current={m.id === activeId ? 'page' : undefined}
                    onClick={() => setActiveId(m.id)}
                  >
                    <span className="nav-icon">{m.icon}</span>
                    {m.title}
                  </button>
                ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className="main">{active ? <active.Page /> : <p>메뉴를 선택하세요.</p>}</main>
      <ToastProvider />
    </div>
  );
}
