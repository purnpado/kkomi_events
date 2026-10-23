import { registerModule } from '../../core/registry';
import MyEventPage from './MyEventPage';

registerModule({
  id: 'myevent',
  title: '나의 경조사',
  icon: '💌',
  order: 100,
  section: 'main',
  Page: MyEventPage,
});
