import React, { useEffect, useState } from 'react';
import { api } from '../../core/api';
import { emit } from '../../core/eventBus';
import { useBusEvent } from '../../core/hooks';
import { Sun, Moon, Users, User, Type, Database, Check } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    theme: 'light',
    usage_mode: 'solo',
    font_scale: '1',
    trash_days: '30',
    backup_keep: '30',
  });
  const [savedKey, setSavedKey] = useState('');

  useEffect(() => {
    api.settings.getAll().then((data) => {
      if (data) setSettings((prev) => ({ ...prev, ...data }));
    }).catch(console.error);
  }, []);

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
            <li>휴지통 자동 비우기: <strong>{settings.trash_days}일</strong> 후 영구 삭제</li>
            <li>자동 백업 보관: 최근 <strong>{settings.backup_keep}개</strong> 보관 (종료 시 자동 백업)</li>
          </ul>
          <div style={{ marginTop: 16 }}>
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
    </>
  );
}
