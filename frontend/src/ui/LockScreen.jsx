import React, { useState, useEffect, useRef } from 'react';
import { Lock, ShieldCheck, KeyRound, Delete, AlertCircle, Sparkles } from 'lucide-react';
import { api } from '../core/api';
import { emit } from '../core/eventBus';
import logoImg from '../assets/logo.png';

/**
 * 토스(Toss) 스타일 미니멀 핀테크 화면 잠금 / 초기 PIN 등록 컴포넌트
 * @param {'unlock' | 'setup'} mode
 * @param {Function} onUnlocked 잠금 해제 성공 콜백
 * @param {Function} onSetupComplete 초기 PIN 설정 완료 콜백
 */
export default function LockScreen({ mode = 'unlock', onUnlocked, onSetupComplete }) {
  // mode === 'setup' 일 때 1차 입력(step 1), 2차 확인 입력(step 2)
  const [setupStep, setSetupStep] = useState(1);
  const [firstPin, setFirstPin] = useState('');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // 일시 잠금 카운트다운 타이머
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          setErrorMsg('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  // 키패드 입력 핸들러
  const handleDigit = (digit) => {
    if (lockoutRemaining > 0 || loading) return;
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMsg('');
      if (nextPin.length === 4) {
        processCompletePin(nextPin);
      }
    }
  };

  const handleDelete = () => {
    if (lockoutRemaining > 0 || loading) return;
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setErrorMsg('');
    }
  };

  const handleClear = () => {
    if (lockoutRemaining > 0 || loading) return;
    setPin('');
    setErrorMsg('');
  };

  // 키보드 이벤트 리스너 (물리 키보드로도 바로 입력 가능)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (lockoutRemaining > 0 || loading) return;
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, lockoutRemaining, loading, setupStep, firstPin]);

  // 틀렸을 때 애니메이션 실행
  const triggerShake = (msg) => {
    setErrorMsg(msg);
    setIsShaking(true);
    setPin('');
    setTimeout(() => setIsShaking(false), 500);
  };

  // 4자리 완료 시 검증 또는 단계 진행
  const processCompletePin = async (completedPin) => {
    if (mode === 'setup') {
      if (setupStep === 1) {
        setFirstPin(completedPin);
        setPin('');
        setSetupStep(2);
        setErrorMsg('');
      } else {
        // Step 2: 확인 일치 여부 체크
        if (completedPin !== firstPin) {
          triggerShake('PIN 번호가 일치하지 않습니다. 다시 입력해 주세요.');
          setSetupStep(1);
          setFirstPin('');
          return;
        }
        // 저장 처리
        setLoading(true);
        try {
          await api.security.setupInitialPin(completedPin);
          emit('toast.show', {
            title: 'PIN 설정 완료',
            message: '화면 잠금 비밀번호가 안전하게 등록되었습니다.',
            type: 'success',
          });
          if (onSetupComplete) onSetupComplete();
        } catch (err) {
          triggerShake(err.message || 'PIN 등록에 실패했습니다.');
          setSetupStep(1);
          setFirstPin('');
        } finally {
          setLoading(false);
        }
      }
    } else {
      // mode === 'unlock'
      setLoading(true);
      try {
        const ok = await api.security.verifyPin(completedPin);
        if (ok) {
          emit('toast.show', {
            title: '잠금 해제',
            message: '환영합니다! 안전하게 화면 잠금이 해제되었습니다.',
            type: 'success',
          });
          if (onUnlocked) onUnlocked();
        } else {
          triggerShake('비밀번호가 일치하지 않습니다.');
        }
      } catch (err) {
        const errMsg = err.message || '비밀번호가 일치하지 않습니다.';
        if (errMsg.includes('30초')) {
          setLockoutRemaining(30);
          triggerShake('연속 5회 실패로 30초 동안 잠깁니다.');
        } else {
          triggerShake(errMsg);
        }
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 50%, #e2e8f0 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        userSelect: 'none',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 400,
          background: '#ffffff',
          borderRadius: 28,
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(15, 23, 42, 0.05)',
          padding: '36px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: 'rise 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* 브랜드 로고 */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            boxShadow: '0 8px 16px -4px rgba(59, 130, 246, 0.15)',
          }}
        >
          <img
            src={logoImg}
            alt="꼬미"
            style={{ width: 44, height: 44, objectFit: 'contain' }}
          />
        </div>

        {/* 상단 타이틀 및 안내 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {mode === 'setup' ? (
            <>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 10px',
                  borderRadius: 12,
                  background: '#f0fdf4',
                  color: '#15803d',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                <Sparkles size={12} /> 최초 실행 보안 등록
              </div>
              <h2 style={{ margin: '0 0 6px', fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                {setupStep === 1 ? '비밀번호(PIN) 설정' : '비밀번호 확인'}
              </h2>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
                {setupStep === 1
                  ? '소중한 장부 보호를 위해 사용할 4자리 숫자를 입력하세요.'
                  : '확인을 위해 동일한 4자리 숫자를 한 번 더 입력하세요.'}
              </p>
            </>
          ) : (
            <>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 10px',
                  borderRadius: 12,
                  background: '#f8fafc',
                  color: '#475569',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                <Lock size={12} /> 화면 잠김
              </div>
              <h2 style={{ margin: '0 0 6px', fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                꼬미경조사가 잠겨 있습니다
              </h2>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
                잠금을 해제하려면 4자리 비밀번호를 입력하세요.
              </p>
            </>
          )}
        </div>

        {/* 4자리 도트(Dot) 인디케이터 */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            justifyContent: 'center',
            marginBottom: 20,
            transform: isShaking ? 'translateX(-8px)' : 'none',
            transition: 'transform 0.1s ease',
            animation: isShaking ? 'shake 0.4s ease-in-out' : 'none',
          }}
        >
          {[0, 1, 2, 3].map((idx) => {
            const filled = pin.length > idx;
            return (
              <div
                key={idx}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: filled ? '#3b82f6' : '#e2e8f0',
                  boxShadow: filled ? '0 0 12px rgba(59, 130, 246, 0.4)' : 'none',
                  transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: filled ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            );
          })}
        </div>

        {/* 에러 메시지 / 카운트다운 */}
        <div style={{ height: 26, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {lockoutRemaining > 0 ? (
            <div style={{ color: '#ef4444', fontSize: '0.84rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={14} /> 5회 오류: {lockoutRemaining}초 후 재시도 가능
            </div>
          ) : errorMsg ? (
            <div style={{ color: '#ef4444', fontSize: '0.84rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={14} /> {errorMsg}
            </div>
          ) : (
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              키보드 숫자(0~9)를 바로 누르셔도 입력됩니다.
            </span>
          )}
        </div>

        {/* 토스 스타일 3x4 키패드 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            width: '100%',
            maxWidth: 280,
            marginBottom: 20,
          }}
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              disabled={lockoutRemaining > 0 || loading}
              onClick={() => handleDigit(num)}
              className="keypad-btn"
              style={{
                height: 58,
                borderRadius: 18,
                border: 'none',
                background: '#f8fafc',
                fontSize: '1.45rem',
                fontWeight: 700,
                color: '#1e293b',
                cursor: lockoutRemaining > 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.12s ease',
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {num}
            </button>
          ))}

          {/* 지우기 / 재설정 버튼 */}
          <button
            type="button"
            disabled={lockoutRemaining > 0 || loading || pin.length === 0}
            onClick={handleClear}
            className="keypad-btn"
            style={{
              height: 58,
              borderRadius: 18,
              border: 'none',
              background: 'transparent',
              fontSize: '0.88rem',
              fontWeight: 700,
              color: '#64748b',
              cursor: lockoutRemaining > 0 || pin.length === 0 ? 'not-allowed' : 'pointer',
              opacity: pin.length === 0 ? 0.3 : 1,
              transition: 'all 0.12s ease',
            }}
          >
            초기화
          </button>

          <button
            type="button"
            disabled={lockoutRemaining > 0 || loading}
            onClick={() => handleDigit('0')}
            className="keypad-btn"
            style={{
              height: 58,
              borderRadius: 18,
              border: 'none',
              background: '#f8fafc',
              fontSize: '1.45rem',
              fontWeight: 700,
              color: '#1e293b',
              cursor: lockoutRemaining > 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.12s ease',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            0
          </button>

          <button
            type="button"
            disabled={lockoutRemaining > 0 || loading || pin.length === 0}
            onClick={handleDelete}
            className="keypad-btn"
            style={{
              height: 58,
              borderRadius: 18,
              border: 'none',
              background: 'transparent',
              color: '#64748b',
              cursor: lockoutRemaining > 0 || pin.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pin.length === 0 ? 0.3 : 1,
              transition: 'all 0.12s ease',
            }}
            title="한 글자 지우기"
          >
            <Delete size={22} />
          </button>
        </div>

        {/* 보안 안내 뱃지 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.76rem',
            color: '#64748b',
            background: '#f1f5f9',
            padding: '6px 12px',
            borderRadius: 12,
          }}
        >
          <ShieldCheck size={14} style={{ color: '#10b981' }} />
          <span>SHA-256 오프라인 암호화 · 외부 서버 전송 없음</span>
        </div>
      </div>
    </div>
  );
}
