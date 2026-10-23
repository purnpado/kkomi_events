import { registerModule } from '../../core/registry';
import SentPage from './SentPage';

registerModule({
  id: 'sent',
  title: '타인의 경조사 (보낸 돈)',
  icon: '📤',
  order: 200,
  section: 'main',
  Page: SentPage,
});
