import { useState, useEffect, useRef } from 'react';
import { getModules } from './core/registry';
import { useBusEvent } from './core/hooks';
import { api } from './core/api';
import ToastProvider from './ui/Toast';
import UpdateModal from './ui/UpdateModal';
import LockScreen from './ui/LockScreen';
import logoImg from './assets/logo.png';
import { MessageSquare, ExternalLink, Sparkles, Lock } from 'lucide-react';

const SECTION_TITLES = { main: '장부', tools: '도구', system: '시스템' };

export default function App() {
  const modules = getModules().filter((m) => m.Page);
  const [activeId, setActiveId] = useState(() => {
    return localStorage.getItem('kkomi_active_tab') || modules[0]?.id;
  });
  const active = modules.find((m) => m.id === activeId);
  const sections = ['main', 'tools', 'system'].filter((s) => modules.some((m) => m.section === s));

  // 보안 및 화면 잠금 상태
  const [securityStatus, setSecurityStatus] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isSettingUpPin, setIsSettingUpPin] = useState(false);
  const lastActivityRef = useRef(Date.now());

  // 자동 업데이트 상태
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);

  const changeTab = (id) => {
    setActiveId(id);
    localStorage.setItem('kkomi_active_tab', id);
  };

  // 보안 상태 로드 및 프로그램 시작 시 잠금 판정
  const loadSecurity = async () => {
    try {
      const st = await api.security.getStatus();
      setSecurityStatus(st);
      if (!st.isPinSet) {
        // 최초 실행: 4자리 PIN 등록 화면 표시
        setIsSettingUpPin(true);
      } else if (st.enabled) {
        // 프로그램 실행 시: 화면 잠금 상태로 진입
        setIsLocked(true);
      }
    } catch (err) {
      console.error('보안 상태 확인 오류:', err);
    }
  };

  useEffect(() => {
    loadSecurity();
  }, []);

  // 보안 설정 변경 이벤트 감지
  useBusEvent('security.changed', () => {
    api.security.getStatus().then((st) => {
      setSecurityStatus(st);
      if (st.isPinSet) setIsSettingUpPin(false);
    });
  });

  // 수동 즉시 잠금 이벤트
  useBusEvent('security.lock', () => {
    if (securityStatus?.isPinSet && securityStatus?.enabled) {
      setIsLocked(true);
    }
  });

  // 자리 비움 자동 잠금 감지 타이머
  useEffect(() => {
    if (!securityStatus?.enabled || !securityStatus?.autoLockMinutes || securityStatus.autoLockMinutes <= 0) {
      return;
    }

    const resetIdleTimer = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('mousedown', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    window.addEventListener('scroll', resetIdleTimer, true);
    window.addEventListener('touchstart', resetIdleTimer);

    const checkInterval = setInterval(() => {
      if (isLocked || isSettingUpPin) return;
      const idleMs = Date.now() - lastActivityRef.current;
      const limitMs = securityStatus.autoLockMinutes * 60 * 1000;
      if (idleMs >= limitMs) {
        setIsLocked(true);
      }
    }, 2000);

    return () => {
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('mousedown', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      window.removeEventListener('scroll', resetIdleTimer, true);
      window.removeEventListener('touchstart', resetIdleTimer);
      clearInterval(checkInterval);
    };
  }, [securityStatus, isLocked, isSettingUpPin]);

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
        <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 화면 잠그기 버튼 (보안 잠금 활성화 시) */}
          {securityStatus?.isPinSet && securityStatus?.enabled && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{
                width: '100%',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 12px',
                fontSize: '0.82rem',
                color: 'var(--fg-muted)',
                borderRadius: 'var(--radius-sm)',
              }}
              onClick={() => setIsLocked(true)}
              title="지금 즉시 장부 화면을 잠급니다."
            >
              <Lock size={13} /> 화면 잠그기
            </button>
          )}

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

      {/* 🔒 최초 4자리 PIN 등록 화면 */}
      {isSettingUpPin && (
        <LockScreen
          mode="setup"
          onSetupComplete={() => {
            setIsSettingUpPin(false);
            setIsLocked(false);
            loadSecurity();
          }}
        />
      )}

      {/* 🔒 화면 잠금 해제 화면 */}
      {isLocked && !isSettingUpPin && (
        <LockScreen
          mode="unlock"
          onUnlocked={() => {
            setIsLocked(false);
            lastActivityRef.current = Date.now();
          }}
        />
      )}
    </div>
  );
}
