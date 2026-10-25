import { useCallback, useEffect, useState } from 'react';
import { api } from '../../core/api';
import { emit } from '../../core/eventBus';
import { useBusEvent } from '../../core/hooks';
import { MessageSquare, ExternalLink, RefreshCw } from 'lucide-react';

function formatBytes(n) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1);
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}

export default function SystemPage() {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [events, setEvents] = useState([]);

  const load = useCallback(async () => {
    try {
      setInfo(await api.system.getInfo());
      setError('');
    } catch (e) {
      setError(String(e.message || e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 모든 이벤트를 받아 화면 아래 기록에 표시
  useBusEvent('*', (e) => {
    setEvents((list) => [e, ...list].slice(0, 12));
  });

  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const uInfo = await api.updater.checkUpdate();
      if (uInfo && uInfo.hasUpdate) {
        emit('updater.showModal', uInfo);
      } else {
        emit('toast.show', {
          title: '최신 버전 사용 중',
          message: `현재 최신 버전(v${uInfo?.currentVersion || info?.version || '0.1.1'})을 사용하고 계십니다.`,
          type: 'success',
        });
      }
    } catch (err) {
      emit('toast.show', {
        title: '업데이트 확인 실패',
        message: String(err),
        type: 'error',
      });
    } finally {
      setCheckingUpdate(false);
    }
  };

  const ping = () => api.system.ping('이벤트 연결 테스트').catch((e) => setError(String(e)));

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">시스템 정보</h1>
        <p className="page-desc">프로그램 상태와 데이터 저장 위치를 확인합니다.</p>
      </header>

      {info?.initError && <div className="alert-error">⚠️ 시작 오류: {info.initError}</div>}
      {error && <div className="alert-error">⚠️ {error}</div>}

      <section className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="stat-label">프로그램 버전</div>
            <div className="stat-value">v{info?.version ?? '-'}</div>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginTop: 8, fontSize: '0.78rem', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4, width: 'fit-content' }}
            disabled={checkingUpdate}
            onClick={handleCheckUpdate}
          >
            <RefreshCw size={12} className={checkingUpdate ? 'spin' : ''} /> 업데이트 확인
          </button>
        </div>
        <div className="card">
          <div className="stat-label">데이터베이스</div>
          <div className="stat-value">
            {info?.dbReady ? <span className="badge badge-ok">정상 연결</span> : <span className="badge badge-err">연결 안 됨</span>}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">DB 크기</div>
          <div className="stat-value">{formatBytes(info?.dbSize)}</div>
        </div>
        <div className="card">
          <div className="stat-label">등록된 모듈</div>
          <div className="stat-value">{info?.modules?.length ?? 0}개</div>
        </div>
      </section>

      {/* 💬 피드백 및 커뮤니티 배너 */}
      <div className="card" style={{ marginBottom: 16, background: '#f0f9ff', borderColor: '#bae6fd' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
              <MessageSquare size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.96rem', fontWeight: 700, color: '#0369a1' }}>꼬미경조사 공식 피드백 게시판</div>
              <div style={{ fontSize: '0.84rem', color: 'var(--fg-muted)' }}>꾹링크 커뮤니티에서 새로운 기능 제안이나 개선 의견을 전해주세요.</div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ color: '#0284c7', borderColor: '#bae6fd', background: '#fff', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem' }}
            onClick={() => api.system.openUrl('https://gguk.link/boards/kkomi_events')}
            title="꼬미경조사 · 꾹링크 게시판으로 이동합니다."
          >
            <ExternalLink size={13} /> 꼬미경조사 · 꾹링크 방문하기
          </button>
        </div>
      </div>

      <section className="grid grid-2">
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>📁 저장 위치 (실행 파일 기준 절대 경로)</h2>
          <ul className="list">
            <li>프로그램 폴더<br /><span className="mono">{info?.paths?.appDir}</span></li>
            <li>데이터베이스<br /><span className="mono">{info?.paths?.dbFile}</span></li>
            <li>백업 폴더<br /><span className="mono">{info?.paths?.backupDir}</span></li>
            <li>로그 폴더<br /><span className="mono">{info?.paths?.logDir}</span></li>
          </ul>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>🧩 모듈 · DB 구조</h2>
          <p className="stat-label">모듈: {info?.modules?.join(', ')}</p>
          <ul className="list">
            {(info?.migrations ?? []).map((m) => (
              <li key={`${m.module}-${m.version}`}>
                <span className="badge">{m.module} v{m.version}</span> {m.name}
              </li>
            ))}
          </ul>
        </div>

        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>⚡ 이벤트 버스 확인</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button id="btn-refresh-info" className="btn btn-ghost" onClick={load}>새로고침</button>
              <button id="btn-ping" className="btn" onClick={ping}>이벤트 보내기</button>
            </div>
          </div>
          <p className="stat-label">버튼을 누르면 Go 백엔드가 이벤트를 발행하고, 화면이 받아서 아래에 표시합니다.</p>
          <ul className="list">
            {events.length === 0 && <li className="stat-label">아직 받은 이벤트가 없습니다.</li>}
            {events.map((e, i) => (
              <li key={`${e.at}-${i}`} className={i === 0 ? 'flash' : ''}>
                <span className="badge">{e.topic}</span>{' '}
                <span className="stat-label">{e.source} · {new Date(e.at).toLocaleTimeString('ko-KR')}</span>{' '}
                <span className="mono">{JSON.stringify(e.payload)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
