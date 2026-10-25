import React, { useState } from 'react';
import Modal from './Modal';
import { api } from '../core/api';
import { useBusEvent } from '../core/hooks';
import { emit } from '../core/eventBus';
import { Download, Sparkles, ExternalLink, RefreshCw, CheckCircle2, AlertCircle, Zap } from 'lucide-react';

export default function UpdateModal({ isOpen, onClose, updateInfo }) {
  const [updating, setUpdating] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, message: '' });
  const [errorMsg, setErrorMsg] = useState('');

  // 백엔드에서 전송되는 실시간 진행률 이벤트 수신
  useBusEvent('updater.progress', (e) => {
    if (e.payload) {
      setProgress({
        percent: e.payload.percent || 0,
        message: e.payload.message || '',
      });
    }
  });

  if (!isOpen || !updateInfo) return null;

  // 원클릭 인플레이스 자동 업데이트 실행
  const handleAutoUpdate = async () => {
    setUpdating(true);
    setErrorMsg('');
    setProgress({ percent: 5, message: '업데이트 서버 연결 중...' });

    try {
      const targetUrl = updateInfo.downloadUrl || updateInfo.releaseUrl;
      await api.updater.applyUpdate(targetUrl);
    } catch (err) {
      console.error('자가 업데이트 실패:', err);
      setErrorMsg(err.message || '자동 업데이트 도중 오류가 발생했습니다. 브라우저 다운로드를 이용해 주세요.');
      setUpdating(false);
    }
  };

  // 브라우저로 릴리즈 다운로드 페이지 열기
  const handleBrowserDownload = () => {
    const url = updateInfo.downloadUrl || updateInfo.releaseUrl || 'https://github.com/purnpado/kkomi_events/releases';
    api.updater.openReleasePage(url);
    onClose();
  };

  const handleOpenRelease = () => {
    const url = updateInfo.releaseUrl || 'https://github.com/purnpado/kkomi_events/releases';
    api.updater.openReleasePage(url);
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => !updating && !open && onClose()}
      title="🎉 꼬미경조사 새 버전 출시 알림"
      description="새로운 기능과 개선사항이 적용된 최신 버전이 준비되었습니다."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 버전 비교 배너 */}
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 'var(--radius)',
            background: 'linear-gradient(135deg, hsl(210 100% 97%), hsl(200 100% 98%))',
            border: '1px solid hsl(205 90% 86%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', fontWeight: 600 }}>현재 사용 중인 버전</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--fg-subtle)' }}>
              v{updateInfo.currentVersion}
            </div>
          </div>
          <div style={{ fontSize: '1.4rem', color: 'var(--primary)', fontWeight: 900 }}>➔</div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
              <Sparkles size={14} /> 최신 버전
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--primary)' }}>
              {updateInfo.latestVersion?.startsWith('v') || updateInfo.latestVersion?.startsWith('V')
                ? updateInfo.latestVersion
                : `v${updateInfo.latestVersion}`}
            </div>
          </div>
        </div>

        {/* 릴리즈 명 및 업데이트 내역 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--fg)' }}>
              {updateInfo.releaseName || '업데이트 주요 내용'}
            </div>
            {updateInfo.releaseUrl && (
              <button
                type="button"
                onClick={handleOpenRelease}
                disabled={updating}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: updating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  textDecoration: 'underline',
                }}
              >
                <ExternalLink size={12} /> GitHub 릴리즈 페이지
              </button>
            )}
          </div>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-sunken)',
              border: '1px solid var(--border)',
              maxHeight: 200,
              overflowY: 'auto',
              fontSize: '0.85rem',
              color: 'var(--fg)',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
            }}
          >
            {updateInfo.releaseBody || '새로운 기능 추가 및 안정성이 향상되었습니다.'}
          </div>
        </div>

        {/* 진행률 게이지 (업데이트 실행 중일 때) */}
        {updating && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-sm)',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.86rem', fontWeight: 700, color: '#166534' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={14} className="spin" />
                {progress.message || '최신 버전을 적용하고 있습니다...'}
              </span>
              <span>{progress.percent}%</span>
            </div>
            <div style={{ width: '100%', height: 8, background: '#dcfce7', borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progress.percent}%`,
                  height: '100%',
                  background: '#16a34a',
                  borderRadius: 4,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <div style={{ fontSize: '0.78rem', color: '#15803d' }}>
              💡 다운로드가 끝나면 새 버전이 자동으로 실행됩니다. 잠시만 기다려 주세요.
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: '0.84rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 하단 액션 버튼 그룹 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: '0.82rem', color: 'var(--fg-muted)' }}
            onClick={handleBrowserDownload}
            disabled={updating}
            title="웹 브라우저를 열어 수동으로 다운로드합니다."
          >
            <Download size={13} /> 브라우저로 직접 다운로드
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={updating}>
              다음에 하기
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={updating}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', fontWeight: 800 }}
              onClick={handleAutoUpdate}
            >
              {updating ? (
                <>
                  <RefreshCw size={15} className="spin" /> 업데이트 진행 중...
                </>
              ) : (
                <>
                  <Zap size={16} /> 지금 원클릭 자동 업데이트
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
