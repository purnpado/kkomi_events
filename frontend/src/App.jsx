import { useState } from 'react';
import { getModules } from './core/registry';
import { useBusEvent } from './core/hooks';
import ToastProvider from './ui/Toast';
import logoImg from './assets/logo.png';

const SECTION_TITLES = { main: '장부', tools: '도구', system: '시스템' };

export default function App() {
  const modules = getModules().filter((m) => m.Page);
  const [activeId, setActiveId] = useState(() => {
    return localStorage.getItem('kkomi_active_tab') || modules[0]?.id;
  });
  const active = modules.find((m) => m.id === activeId);
  const sections = ['main', 'tools', 'system'].filter((s) => modules.some((m) => m.section === s));

  const changeTab = (id) => {
    setActiveId(id);
    localStorage.setItem('kkomi_active_tab', id);
  };

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
          <div className="brand-logo" aria-hidden style={{ overflow: 'hidden', padding: 0, background: 'transparent', boxShadow: 'none' }}>
            <img src={logoImg} alt="꼬미 로고" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 10 }} />
          </div>
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
                    onClick={() => changeTab(m.id)}
                  >
                    <span className="nav-icon">{m.icon}</span>
                    {m.title}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-sunken)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--income)' }} />
              100% 로컬 오프라인
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--fg-muted)' }}>
              소중한 개인정보가 내 PC에만 안전하게 보관됩니다.
            </div>
          </div>
        </div>
      </aside>
      <main className="main">{active ? <active.Page /> : <p>메뉴를 선택하세요.</p>}</main>
      <ToastProvider />
    </div>
  );
}
