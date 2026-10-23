import { registerModule } from '../../core/registry';
import MatchingPage from './MatchingPage';

registerModule({
  id: 'matching',
  title: '사람별 매칭 (주고받은 내역)',
  icon: '⚖️',
  order: 300,
  section: 'main',
  Page: MatchingPage,
});
