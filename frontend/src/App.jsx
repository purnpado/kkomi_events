import { useState, useEffect } from 'react';
import { getModules } from './core/registry';
import { useBusEvent } from './core/hooks';
import { api } from './core/api';
import ToastProvider from './ui/Toast';
import UpdateModal from './ui/UpdateModal';
import logoImg from './assets/logo.png';
import { MessageSquare, ExternalLink, Sparkles } from 'lucide-react';

const SECTION_TITLES = { main: '장부', tools: '도구', system: '시스템' };

export default function App() {
  const modules = getModules().filter((m) => m.Page);
  const [activeId, setActiveId] = useState(() => {
    return localStorage.getItem('kkomi_active_tab') || modules[0]?.id;
  });
  const active = modules.find((m) => m.id === activeId);
  const sections = ['main', 'tools', 'system'].filter((s) => modules.some((m) => m.section === s));

  // 자동 업데이트 상태
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);

  const changeTab = (id) => {
    setActiveId(id);
    localStorage.setItem('kkomi_active_tab', id);
  };

  // nav.goto 이벤트 수신 시 해당 화면으로 자동 이동
  useBusEvent('nav.goto', (e) => {
    if (e.payload) setActiveId(e.payload);
  });

  // 백엔드에서 새 버전 발견 시 자동 팝업 및 상태 저장
  useBusEvent('updater.available', (e) => {
    if (e.payload && e.payload.hasUpdate) {
      setUpdateInfo(e.payload);
      setUpdateModalOpen(true);
    }
  });

  // 수동 확인 등에서 모달 오픈 요청
  useBusEvent('updater.showModal', (e) => {
    if (e.payload) setUpdateInfo(e.payload);
    setUpdateModalOpen(true);
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="brand-ver">경조사비 장부</span>
              {updateInfo?.hasUpdate && (
                <button
                  type="button"
                  onClick={() => setUpdateModalOpen(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '2px 7px',
                    borderRadius: 12,
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  title="새로운 버전이 있습니다! 클릭하여 확인하세요."
                >
                  <Sparkles size={10} /> NEW
                </button>
              )}
            </div>
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
        <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* 피드백 및 건의사항 버튼 (꾹링크 커뮤니티 게시판 바로가기) */}
          <button
            type="button"
            className="btn-feedback-sidebar"
            onClick={() => api.system.openUrl('https://gguk.link/boards/kkomi_events')}
            title="꼬미경조사 · 꾹링크 게시판으로 이동하여 의견이나 피드백을 남깁니다."
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <MessageSquare size={15} />
              <span>피드백 및 건의사항</span>
            </div>
            <ExternalLink size={13} style={{ opacity: 0.65 }} />
          </button>

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
      <UpdateModal
        isOpen={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        updateInfo={updateInfo}
      />
    </div>
  );
}
