import ChartPlugin from '../../core/models/ChartPlugin';
import ChartMetadata from '../../core/models/ChartMetadata';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: 'Multiple Line Charts',
  description: '',
  credits: ['http://nvd3.org'],
  thumbnail,
});

export default class LineChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      loadChart: () => import('./LineMulti.jsx'),
    });
  }
}
