import React, { useEffect, useState } from 'react';
import { api } from '../../core/api';
import { emit } from '../../core/eventBus';
import { useBusEvent } from '../../core/hooks';
import { Sun, Moon, Users, User, Type, Database, Check, Calendar, ExternalLink, RefreshCw, Trash2, MessageSquare, Sparkles, Lock, Shield, KeyRound, Clock, ShieldCheck } from 'lucide-react';
import TrashModal from '../../ui/TrashModal';
import PinChangeModal from '../../ui/PinChangeModal';

export default function SettingsPage() {
  const [trashOpen, setTrashOpen] = useState(false);
  const [pinChangeOpen, setPinChangeOpen] = useState(false);
  const [securityStatus, setSecurityStatus] = useState({
    isPinSet: false,
    enabled: true,
    autoLockMinutes: 5,
  });
  const [pinPromptOpen, setPinPromptOpen] = useState(false);
  const [pendingConfig, setPendingConfig] = useState(null);
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinPromptError, setPinPromptError] = useState('');

  const [settings, setSettings] = useState({
    theme: 'light',
    usage_mode: 'solo',
    font_scale: '1',
    trash_days: '30',
    backup_keep: '30',
  });
  const [savedKey, setSavedKey] = useState('');

  // 구글 캘린더 연동 상태
  const [calConfig, setCalConfig] = useState({
    mode: 'none',
    icalUrl: '',
    apiKey: '',
    calendarId: 'primary',
    lastSyncAt: '',
    lastSyncMsg: '',
    syncCount: 0,
  });
  const [testing, setTesting] = useState(false);

  const loadCalendarConfig = async () => {
    try {
      const cfg = await api.calendar.getConfig();
      if (cfg) setCalConfig((prev) => ({ ...prev, ...cfg }));
    } catch (err) {
      console.error(err);
    }
  };

  const loadSecurityStatus = async () => {
    try {
      const st = await api.security.getStatus();
      if (st) setSecurityStatus(st);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    api.settings.getAll().then((data) => {
      if (data) setSettings((prev) => ({ ...prev, ...data }));
    }).catch(console.error);
    loadCalendarConfig();
    loadSecurityStatus();
  }, []);

  useBusEvent('security.changed', () => {
    loadSecurityStatus();
  });

  const handleModeChange = async (newMode) => {
    setCalConfig((prev) => ({ ...prev, mode: newMode }));
    try {
      await api.calendar.saveConfig(newMode, calConfig.icalUrl, calConfig.apiKey, calConfig.calendarId);
      emit('toast.show', {
        title: '연동 방식 변경',
        message: newMode === 'none' ? '캘린더 연동이 해제되었습니다.' : '연동 방식이 변경되었습니다.',
        type: 'success',
      });
    } catch (err) {
      emit('toast.show', { title: '저장 실패', message: String(err), type: 'error' });
    }
  };

  const handleTestAndSync = async () => {
    setTesting(true);
    try {
      const res = await api.calendar.testAndSync(
        calConfig.mode,
        calConfig.icalUrl,
        calConfig.apiKey,
        calConfig.calendarId
      );
      if (res) {
        setCalConfig((prev) => ({ ...prev, ...res }));
        emit('toast.show', {
          title: '동기화 완료',
          message: res.lastSyncMsg || `경조사 일정 ${res.syncCount}건을 가져왔습니다.`,
          type: 'success',
        });
      }
    } catch (err) {
      emit('toast.show', {
        title: '동기화 실패',
        message: String(err),
        type: 'error',
      });
    } finally {
      setTesting(false);
    }
  };

  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const info = await api.updater.checkUpdate();
      if (info && info.hasUpdate) {
        emit('updater.showModal', info);
      } else {
        emit('toast.show', {
          title: '최신 버전 사용 중',
          message: `현재 최신 버전(v${info?.currentVersion || '0.1.1'})을 사용하고 계십니다.`,
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

  useBusEvent('settings.changed', (e) => {
    const { key, value } = e.payload || {};
    if (key) {
      setSettings((prev) => ({ ...prev, [key]: value }));
      setSavedKey(key);
      setTimeout(() => setSavedKey(''), 1500);
    }
  });

  const updateSetting = async (key, val) => {
    try {
      await api.settings.set(key, val);
      emit('toast.show', {
        title: '설정 저장',
        message: '설정이 안전하게 저장되었습니다.',
        type: 'success',
      });
    } catch (err) {
      emit('toast.show', {
        title: '저장 실패',
        message: String(err),
        type: 'error',
      });
    }
  };

  const handleRequestConfigChange = (newEnabled, newAutoLock) => {
    setPendingConfig({
      enabled: newEnabled !== undefined ? newEnabled : securityStatus.enabled,
      autoLockMinutes: newAutoLock !== undefined ? newAutoLock : securityStatus.autoLockMinutes,
    });
    setConfirmPinInput('');
    setPinPromptError('');
    setPinPromptOpen(true);
  };

  const handleSubmitConfigWithPin = async (e) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(confirmPinInput)) {
      setPinPromptError('PIN 번호 4자리를 정확히 입력해 주세요.');
      return;
    }
    try {
      await api.security.updateConfig(
        pendingConfig.enabled,
        pendingConfig.autoLockMinutes,
        confirmPinInput
      );
      setSecurityStatus((prev) => ({
        ...prev,
        enabled: pendingConfig.enabled,
        autoLockMinutes: pendingConfig.autoLockMinutes,
      }));
      setPinPromptOpen(false);
      setPendingConfig(null);
      setConfirmPinInput('');
      emit('toast.show', {
        title: '보안 설정 변경 완료',
        message: '화면 잠금 보안 설정이 안전하게 저장되었습니다.',
        type: 'success',
      });
    } catch (err) {
      setPinPromptError(err.message || '비밀번호가 일치하지 않습니다.');
    }
  };

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">프로그램 설정</h1>
        <p className="page-desc">화면 테마, 글자 크기 및 사용 방식을 설정합니다.</p>
      </header>

      <div className="grid grid-2">
        {/* 테마 설정 */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Sun size={20} className="stat-label" />
            <h2 style={{ margin: 0, fontSize: '1.15rem' }}>화면 테마</h2>
          </div>
          <p className="form-desc" style={{ marginBottom: 16 }}>
            선호하는 화면 색상 테마를 선택하세요.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              className={`btn ${settings.theme === 'light' ? '' : 'btn-ghost'}`}
              onClick={() => updateSetting('theme', 'light')}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              <Sun size={18} /> 라이트 모드
              {settings.theme === 'light' && <Check size={16} />}
            </button>
            <button
              type="button"
              className={`btn ${settings.theme === 'dark' ? '' : 'btn-ghost'}`}
              onClick={() => updateSetting('theme', 'dark')}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              <Moon size={18} /> 다크 모드
              {settings.theme === 'dark' && <Check size={16} />}
            </button>
          </div>
        </div>

        {/* 사용 방식 (공동 사용 모드 여부) */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Users size={20} className="stat-label" />
            <h2 style={{ margin: 0, fontSize: '1.15rem' }}>사용 방식</h2>
          </div>
          <p className="form-desc" style={{ marginBottom: 16 }}>
            개인 혼자 사용할지, 배우자나 가족과 함께 분담하여 사용할지 선택합니다.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              className={`btn ${settings.usage_mode === 'solo' ? '' : 'btn-ghost'}`}
              onClick={() => updateSetting('usage_mode', 'solo')}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              <User size={18} /> 혼자 사용
              {settings.usage_mode === 'solo' && <Check size={16} />}
            </button>
            <button
              type="button"
              className={`btn ${settings.usage_mode === 'shared' ? '' : 'btn-ghost'}`}
              onClick={() => updateSetting('usage_mode', 'shared')}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              <Users size={18} /> 함께 사용
              {settings.usage_mode === 'shared' && <Check size={16} />}
            </button>
          </div>
          <div style={{ marginTop: 12, fontSize: '0.82rem', color: 'var(--fg-muted)' }}>
            {settings.usage_mode === 'shared' ? (
              <span>💡 '함께 사용' 모드: 경조사 기록마다 신랑측/신부측, 본인/배우자 손님 구분이 활성화됩니다.</span>
            ) : (
              <span>💡 '혼자 사용' 모드: 손님 구분 없이 간결하게 입력합니다.</span>
            )}
          </div>
        </div>

        {/* 글자 크기 */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Type size={20} className="stat-label" />
            <h2 style={{ margin: 0, fontSize: '1.15rem' }}>글자 크기</h2>
          </div>
          <p className="form-desc" style={{ marginBottom: 16 }}>
            눈이 편안한 글자 크기를 선택하세요.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { val: '0.95', label: '작게' },
              { val: '1', label: '보통 (권장)' },
              { val: '1.1', label: '크게' },
              { val: '1.2', label: '아주 크게' },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                className={`btn ${settings.font_scale === opt.val ? '' : 'btn-ghost'}`}
                style={{ flex: 1, padding: '8px 4px', fontSize: '0.88rem', justifyContent: 'center' }}
                onClick={() => updateSetting('font_scale', opt.val)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 데이터 관리 안내 */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Database size={20} className="stat-label" />
            <h2 style={{ margin: 0, fontSize: '1.15rem' }}>보안 및 데이터 관리</h2>
          </div>
          <p className="form-desc" style={{ marginBottom: 12 }}>
            꼬미경조사는 모든 데이터를 사용자 컴퓨터(실행 파일 폴더 내)에 암호화 보관하며, 외부 서버로 이름이나 금액을 절대 전송하지 않습니다.
          </p>
          <ul className="list">
            <li>삭제한 항목(휴지통): 직접 삭제한 쓰레기 데이터만 <strong>{settings.trash_days}일</strong> 보관 후 영구 정리 (정상 등록된 경조사는 영구 보관)</li>
            <li>자동 백업 파일 보관: 전체 DB 백업 파일 최근 <strong>{settings.backup_keep}개</strong> 보관 (프로그램 종료 시 스냅샷 자동 생성)</li>
          </ul>
          <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setTrashOpen(true)}
              title="삭제한 축의금, 부의금, 행사 목록을 확인하고 다시 복원합니다."
            >
              <Trash2 size={15} /> 휴지통 열기 (복원 및 정리)
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={async () => {
                try {
                  const b = await api.backup.createBackup('수동백업');
                  emit('toast.show', {
                    title: '백업 생성 완료',
                    message: `${b.fileName} 파일로 안전하게 저장되었습니다.`,
                    type: 'success',
                  });
                } catch (err) {
                  emit('toast.show', { title: '백업 실패', message: String(err), type: 'error' });
                }
              }}
            >
              <Database size={15} /> 지금 즉시 백업 파일 생성
            </button>
          </div>
        </div>
      </div>

      {/* ── 화면 잠금 및 보안 (PIN) 설정 카드 ── */}
      <div className="card" style={{ marginTop: 24, border: '1.5px solid var(--border-light)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fef3c7', color: '#d97706', display: 'grid', placeItems: 'center' }}>
              <Lock size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>화면 잠금 및 PIN 보안 설정</h2>
                {securityStatus.enabled ? (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#dcfce7', color: '#15803d' }}>
                    보안 켜짐
                  </span>
                ) : (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#f1f5f9', color: '#64748b' }}>
                    잠금 해제됨 (미사용)
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--fg-muted)' }}>
                프로그램 실행 시 및 자리 비움 시 장부 화면을 4자리 비밀번호로 안전하게 보호합니다.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => emit('security.lock')}
              title="지금 즉시 장부 화면을 잠급니다."
            >
              <Lock size={15} /> 지금 화면 잠그기
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPinChangeOpen(true)}
              title="4자리 PIN 비밀번호를 변경합니다."
            >
              <KeyRound size={15} /> PIN 번호 변경
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, background: 'var(--bg-sunken)', padding: 18, borderRadius: 'var(--radius)' }}>
          {/* 사용 여부 스위치 */}
          <div>
            <label className="form-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={16} /> 화면 잠금 기능 사용 여부
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`btn ${securityStatus.enabled ? '' : 'btn-ghost'}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => handleRequestConfigChange(true, undefined)}
              >
                <Lock size={15} /> 잠금 사용
                {securityStatus.enabled && <Check size={15} />}
              </button>
              <button
                type="button"
                className={`btn ${!securityStatus.enabled ? '' : 'btn-ghost'}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => handleRequestConfigChange(false, undefined)}
              >
                사용 안 함
                {!securityStatus.enabled && <Check size={15} />}
              </button>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginTop: 6 }}>
              {securityStatus.enabled ? '프로그램 시작 시 및 일정 시간 미입력 시 잠금 화면이 뜹니다.' : '비밀번호 확인 없이 프로그램이 바로 시작됩니다.'}
            </div>
          </div>

          {/* 자동 잠금 대기 시간 */}
          <div>
            <label className="form-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={16} /> 자리 비움 자동 잠금 대기 시간
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { val: 1, label: '1분' },
                { val: 3, label: '3분' },
                { val: 5, label: '5분 (권장)' },
                { val: 10, label: '10분' },
                { val: 15, label: '15분' },
                { val: 30, label: '30분' },
                { val: 0, label: '미사용' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  disabled={!securityStatus.enabled}
                  className={`btn ${securityStatus.autoLockMinutes === opt.val ? '' : 'btn-ghost'}`}
                  style={{
                    padding: '6px 10px',
                    fontSize: '0.82rem',
                    opacity: !securityStatus.enabled ? 0.4 : 1,
                  }}
                  onClick={() => handleRequestConfigChange(undefined, opt.val)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginTop: 6 }}>
              마우스나 키보드 입력이 지정된 시간 동안 없으면 자동으로 화면이 잠깁니다.
            </div>
          </div>
        </div>
      </div>

      {/* ── 구글 캘린더 연동 설정 섹션 (방안 1 & 방안 2 선택 지원) ── */}
      <div className="card" style={{ marginTop: 24, border: '1.5px solid var(--border-light)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e0f2fe', color: '#0284c7', display: 'grid', placeItems: 'center' }}>
              <Calendar size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>구글 캘린더 연동 설정</h2>
              <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--fg-muted)' }}>
                구글 캘린더에 적어둔 지인 결혼식, 돌잔치, 장례식 일정을 읽어와 대시보드 [다가오는 챙길 경조사]에 띄워줍니다.
              </p>
            </div>
          </div>
          {calConfig.lastSyncAt && (
            <span style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>
              최근 동기화: {calConfig.lastSyncAt}
            </span>
          )}
        </div>

        {/* 연동 모드 선택 3종 */}
        <div style={{ marginBottom: 18 }}>
          <label className="form-label" style={{ marginBottom: 8 }}>연동 방식 선택</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <button
              type="button"
              className={`btn ${calConfig.mode === 'none' ? '' : 'btn-ghost'}`}
              style={{ justifyContent: 'flex-start', padding: '12px 16px', height: 'auto' }}
              onClick={() => handleModeChange('none')}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.94rem' }}>⚪ 미사용</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginTop: 2 }}>로컬 장부 일정만 사용</div>
              </div>
            </button>

            <button
              type="button"
              className={`btn ${calConfig.mode === 'ical' ? '' : 'btn-ghost'}`}
              style={{ justifyContent: 'flex-start', padding: '12px 16px', height: 'auto', borderColor: calConfig.mode === 'ical' ? 'var(--primary)' : undefined }}
              onClick={() => handleModeChange('ical')}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--primary)' }}>🟢 [간편] iCal 비공개 URL (추천)</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginTop: 2 }}>복잡한 가입 없이 주소 복사로 1초 완성</div>
              </div>
            </button>

            <button
              type="button"
              className={`btn ${calConfig.mode === 'api' ? '' : 'btn-ghost'}`}
              style={{ justifyContent: 'flex-start', padding: '12px 16px', height: 'auto' }}
              onClick={() => handleModeChange('api')}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.94rem' }}>🔵 [고급] Google Calendar API Key (공개 캘린더용)</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginTop: 2 }}>구글 공식 개발자 API 연동 (비공개 개인 일정은 iCal 권장)</div>
              </div>
            </button>
          </div>
        </div>

        {/* 모드 1: iCal 비공개 URL 연동 폼 */}
        {calConfig.mode === 'ical' && (
          <div style={{ background: 'var(--bg-sunken)', padding: 18, borderRadius: 'var(--radius)', animation: 'rise 0.2s var(--ease)' }}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>구글 캘린더 iCal 비공개 주소 (.ics) *</span>
                <button
                  type="button"
                  onClick={() => api.calendar.openUrl('https://calendar.google.com/calendar/r/settings')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                  title="새 창에서 구글 캘린더 설정 페이지 열기"
                >
                  <ExternalLink size={13} /> Google 캘린더 설정 바로가기
                </button>
              </label>
              <input
                type="text"
                className="input-text"
                placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                value={calConfig.icalUrl}
                onChange={(e) => setCalConfig({ ...calConfig, icalUrl: e.target.value })}
                style={{ fontSize: '0.9rem' }}
              />
            </div>

            <div style={{ fontSize: '0.84rem', color: 'var(--fg-muted)', lineHeight: 1.6, marginBottom: 16 }}>
              💡 <strong>1분 안내:</strong>{' '}
              <a
                href="#open-google-settings"
                onClick={(e) => {
                  e.preventDefault();
                  api.calendar.openUrl('https://calendar.google.com/calendar/r/settings');
                }}
                style={{ color: 'var(--primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}
              >
                Google 캘린더 설정 웹페이지 <ExternalLink size={12} />
              </a>
              에 접속 후 → 좌측의 내 캘린더 클릭 → 아래로 스크롤하여 <strong>[iCal 형식의 비공개 주소]</strong>를 복사하여 위 칸에 붙여넣으세요.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                className="btn"
                disabled={testing}
                onClick={handleTestAndSync}
              >
                {testing ? <RefreshCw size={15} className="spin" /> : <RefreshCw size={15} />} 지금 연결 테스트 및 동기화
              </button>
            </div>
          </div>
        )}

        {/* 모드 2: Google Calendar API Key 연동 폼 */}
        {calConfig.mode === 'api' && (
          <div style={{ background: 'var(--bg-sunken)', padding: 18, borderRadius: 'var(--radius)', animation: 'rise 0.2s var(--ease)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Google Calendar API Key (구글 캘린더 API 키) *</span>
                  <button
                    type="button"
                    onClick={() => api.calendar.openUrl('https://console.cloud.google.com/apis/credentials')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                    title="새 창에서 구글 클라우드 콘솔 열기"
                  >
                    <ExternalLink size={13} /> Google Cloud 콘솔 바로가기
                  </button>
                </label>
                <input
                  type="password"
                  className="input-text"
                  placeholder="AIzaSy..."
                  value={calConfig.apiKey}
                  onChange={(e) => setCalConfig({ ...calConfig, apiKey: e.target.value })}
                  style={{ fontSize: '0.9rem' }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">캘린더 ID (Gmail 주소)</label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="예: teacher@gmail.com"
                  value={calConfig.calendarId}
                  onChange={(e) => setCalConfig({ ...calConfig, calendarId: e.target.value })}
                  style={{ fontSize: '0.9rem' }}
                />
              </div>
            </div>

            <div style={{ fontSize: '0.84rem', color: 'var(--fg-muted)', lineHeight: 1.6, marginBottom: 16, background: 'var(--bg-card)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, color: 'var(--fg-main)', marginBottom: 4 }}>
                💡 <strong>구글 캘린더 API 키 설정 안내 및 404 오류 주의사항:</strong>
              </div>
              <div>• <strong>명칭 안내:</strong> 구글 클라우드 콘솔에서 발급받지만 실제 사용되는 서비스는 <strong>Google Calendar API</strong> 키입니다.</div>
              <div>• <strong>캘린더 ID:</strong> <code>primary</code>는 로그인 세션(OAuth2)이 없으면 구글에서 인식하지 못해 <strong>404 오류</strong>가 발생합니다. 본인의 구글 이메일(예: <code>xxx@gmail.com</code>)을 입력해야 합니다.</div>
              <div>• <strong>개인 캘린더 권장:</strong> 구글 보안 정책상 <strong>비공개 개인 캘린더</strong>는 단순 API 키로 조회가 차단됩니다. 개인 경조사 일정은 상단의 <strong>[간편] iCal 비공개 URL</strong> 방식을 사용하시면 별도 설정 없이 바로 안전하게 연동됩니다.</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                className="btn"
                disabled={testing}
                onClick={handleTestAndSync}
              >
                {testing ? <RefreshCw size={15} className="spin" /> : <RefreshCw size={15} />} API 연결 테스트 및 일정 가져오기
              </button>
            </div>
          </div>
        )}

        {/* 동기화 상태 메시지 알림 */}
        {calConfig.lastSyncMsg && (
          <div style={{ marginTop: 14, fontSize: '0.86rem', color: calConfig.lastSyncMsg.includes('실패') || calConfig.lastSyncMsg.includes('오류') ? 'var(--expense)' : 'var(--income)', fontWeight: 600 }}>
            {calConfig.lastSyncMsg}
          </div>
        )}
      </div>

      {/* 🚀 자동 업데이트 및 배포 버전 확인 */}
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.02rem', fontWeight: 700, color: 'var(--fg)', marginBottom: 4 }}>
              <Sparkles size={18} style={{ color: 'var(--primary)' }} />
              <span>프로그램 자동 업데이트</span>
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
              공식 GitHub 배포 저장소(<code>purnpado/kkomi_events</code>)에서 새 버전을 확인하고 안전하게 다운로드합니다.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', fontSize: '0.88rem' }}
            disabled={checkingUpdate}
            onClick={handleCheckUpdate}
          >
            {checkingUpdate ? <RefreshCw size={14} className="spin" /> : <RefreshCw size={14} />} 최신 버전 확인
          </button>
        </div>
      </div>

      {/* 💬 커뮤니티 지원 및 피드백 */}
      <div className="card" style={{ marginTop: 16, background: 'linear-gradient(135deg, hsl(200 100% 98%), hsl(210 100% 99%))', borderColor: 'hsl(200 80% 88%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.02rem', fontWeight: 700, color: '#0369a1', marginBottom: 4 }}>
              <MessageSquare size={18} />
              <span>피드백 및 기능 제안 (꼬미경조사 · 꾹링크)</span>
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
              프로그램 사용 중 건의사항, 개선 의견, 버그 제보가 있으시면 언제든 커뮤니티에 남겨주세요.
            </div>
          </div>
          <button
            type="button"
            className="btn"
            style={{ background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', fontSize: '0.88rem' }}
            onClick={() => api.system.openUrl('https://gguk.link/boards/kkomi_events')}
            title="새 브라우저 창에서 꼬미경조사 · 꾹링크 게시판을 엽니다."
          >
            <ExternalLink size={14} /> 피드백 게시판 바로가기
          </button>
        </div>
      </div>

      {/* 휴지통 모달 */}
      <TrashModal isOpen={trashOpen} onClose={() => setTrashOpen(false)} />

      {/* PIN 번호 변경 모달 */}
      <PinChangeModal isOpen={pinChangeOpen} onClose={() => setPinChangeOpen(false)} />

      {/* 보안 설정 변경을 위한 PIN 확인 팝업 */}
      {pinPromptOpen && (
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
          onClick={() => setPinPromptOpen(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 380,
              background: '#ffffff',
              borderRadius: 20,
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: '#fef3c7', color: '#d97706', display: 'grid', placeItems: 'center' }}>
                <Lock size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>보안 확인</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--fg-muted)' }}>
                  설정을 변경하려면 4자리 PIN 번호를 입력하세요.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitConfigWithPin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pinPromptError && (
                <div style={{ padding: '8px 10px', borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontSize: '0.82rem', fontWeight: 600 }}>
                  {pinPromptError}
                </div>
              )}
              <input
                type="password"
                maxLength={4}
                className="input-text"
                placeholder="••••"
                value={confirmPinInput}
                onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                style={{ fontSize: '1.25rem', letterSpacing: '0.4em', textAlign: 'center' }}
                autoFocus
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setPinPromptOpen(false)}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary" disabled={confirmPinInput.length !== 4}>
                  확인
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
