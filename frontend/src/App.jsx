// 화면 틀: 왼쪽 메뉴(등록된 모듈 자동 표시) + 오른쪽 본문
import { useState } from 'react';
import { getModules } from './core/registry';

const SECTION_TITLES = { main: '장부', tools: '도구', system: '시스템' };

export default function App() {
  const modules = getModules().filter((m) => m.Page);
  const [activeId, setActiveId] = useState(modules[0]?.id);
  const active = modules.find((m) => m.id === activeId);
  const sections = ['main', 'tools', 'system'].filter((s) => modules.some((m) => m.section === s));

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
    </div>
  );
}
