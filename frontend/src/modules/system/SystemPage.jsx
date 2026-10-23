// 시스템 정보 화면: 프로그램 상태와 이벤트 연결을 확인합니다.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../core/api';
import { useBusEvent } from '../../core/hooks';

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
        <div className="card">
          <div className="stat-label">버전</div>
          <div className="stat-value">v{info?.version ?? '-'}</div>
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
