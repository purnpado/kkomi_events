import React, { useState } from 'react';
import { KeyRound, Check, X, ShieldAlert, Sparkles } from 'lucide-react';
import { api } from '../core/api';
import { emit } from '../core/eventBus';

export default function PinChangeModal({ isOpen, onClose }) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setErrorMsg('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!/^\d{4}$/.test(currentPin)) {
      setErrorMsg('현재 PIN 번호 4자리를 정확히 입력해 주세요.');
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      setErrorMsg('새로운 PIN 번호 4자리를 정확히 입력해 주세요.');
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMsg('새로운 PIN 번호 확인이 일치하지 않습니다.');
      return;
    }
    if (currentPin === newPin) {
      setErrorMsg('현재 사용 중인 비밀번호와 동일합니다.');
      return;
    }

    setLoading(true);
    try {
      await api.security.changePin(currentPin, newPin);
      emit('toast.show', {
        title: 'PIN 변경 완료',
        message: '비밀번호가 성공적으로 변경되었습니다.',
        type: 'success',
      });
      handleClose();
    } catch (err) {
      setErrorMsg(err.message || 'PIN 변경에 실패했습니다. 현재 비밀번호를 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={handleClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#ffffff',
          borderRadius: 20,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          padding: 24,
          animation: 'rise 0.25s var(--ease)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: '#eff6ff',
                color: '#3b82f6',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <KeyRound size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>4자리 PIN 번호 변경</h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--fg-muted)' }}>
                새로운 잠금 해제 비밀번호를 설정합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: 6, borderRadius: '50%' }}
            onClick={handleClose}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {errorMsg && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: '#fef2f2',
                color: '#dc2626',
                fontSize: '0.84rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ShieldAlert size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="form-label" style={{ marginBottom: 6 }}>
              현재 PIN 번호 (4자리)
            </label>
            <input
              type="password"
              maxLength={4}
              className="input-text"
              placeholder="••••"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              style={{ fontSize: '1.2rem', letterSpacing: '0.4em', textAlign: 'center' }}
              autoFocus
            />
          </div>

          <div>
            <label className="form-label" style={{ marginBottom: 6 }}>
              새로운 PIN 번호 (4자리)
            </label>
            <input
              type="password"
              maxLength={4}
              className="input-text"
              placeholder="••••"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              style={{ fontSize: '1.2rem', letterSpacing: '0.4em', textAlign: 'center' }}
            />
          </div>

          <div>
            <label className="form-label" style={{ marginBottom: 6 }}>
              새로운 PIN 번호 확인
            </label>
            <input
              type="password"
              maxLength={4}
              className="input-text"
              placeholder="••••"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              style={{ fontSize: '1.2rem', letterSpacing: '0.4em', textAlign: 'center' }}
            />
          </div>

          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={handleClose} disabled={loading}>
              취소
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || currentPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4}
            >
              <Check size={16} /> {loading ? '변경 중...' : '비밀번호 변경'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
