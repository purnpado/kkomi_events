import { registerModule } from '../../core/registry';
import DashboardPage from './DashboardPage';

registerModule({
  id: 'dashboard',
  title: '대시보드 (현황 요약)',
  icon: '📊',
  order: 50,
  section: 'main',
  Page: DashboardPage,
});
