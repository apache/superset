import ChartPlugin from '../../../core/models/ChartPlugin';
import ChartMetadata from '../../../core/models/ChartMetadata';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: 'deck.gl Screen Grid',
  description: '',
  credits: ['https://uber.github.io/deck.gl'],
  thumbnail,
});

export default class ScreengridChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      loadChart: () => import('./Screengrid.jsx'),
    });
  }
}
