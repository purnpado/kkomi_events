// 시스템 모듈 등록
import { registerModule } from '../../core/registry';
import SystemPage from './SystemPage';

registerModule({
  id: 'system',
  title: '시스템 정보',
  icon: '🛠️',
  order: 900,
  section: 'system',
  Page: SystemPage,
});
