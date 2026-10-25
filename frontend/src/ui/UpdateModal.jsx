import React from 'react';
import Modal from './Modal';
import { api } from '../core/api';
import { Download, Sparkles, ExternalLink } from 'lucide-react';

export default function UpdateModal({ isOpen, onClose, updateInfo }) {
  if (!isOpen || !updateInfo) return null;

  const handleDownload = () => {
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
      onOpenChange={(open) => !open && onClose()}
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
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
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
              maxHeight: 220,
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

        {/* 하단 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            다음에 하기
          </button>
          <button
            type="button"
            className="btn"
            style={{ background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', fontWeight: 800 }}
            onClick={handleDownload}
          >
            <Download size={16} /> 지금 새 버전 다운로드
          </button>
        </div>
      </div>
    </Modal>
  );
}
