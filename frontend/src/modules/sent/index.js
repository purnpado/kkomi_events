import { registerModule } from '../../core/registry';
import SentPage from './SentPage';

registerModule({
  id: 'sent',
  title: '타인 경조사',
  icon: '📤',
  order: 200,
  section: 'main',
  Page: SentPage,
});
