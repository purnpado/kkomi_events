// 설정 모듈: 테마 등 설정값을 화면에 적용합니다.
// settings.changed 이벤트를 구독해서 다른 곳에서 바꿔도 즉시 반영됩니다.
import { api } from '../../core/api';
import { on } from '../../core/eventBus';
import { registerModule } from '../../core/registry';

function applySetting(key, value) {
  const root = document.documentElement;
  if (key === 'theme') root.dataset.theme = value;
  if (key === 'font_scale') root.style.setProperty('--font-scale', value);
}

registerModule({
  id: 'settings',
  title: '설정',
  icon: '⚙️',
  order: 800,
  section: 'system',
  Page: null, // 2단계 이후 설정 화면 추가 예정
  setup() {
    on('settings.changed', (e) => applySetting(e.payload.key, e.payload.value));
    api.settings
      .getAll()
      .then((all) => Object.entries(all).forEach(([k, v]) => applySetting(k, v)))
      .catch(() => {});
  },
});
