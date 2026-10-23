import { registerModule } from '../../core/registry';
import MatchingPage from './MatchingPage';

registerModule({
  id: 'matching',
  title: '경조사비 조회',
  icon: '🔍',
  order: 300,
  section: 'main',
  Page: MatchingPage,
});
