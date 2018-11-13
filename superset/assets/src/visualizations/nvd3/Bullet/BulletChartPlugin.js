import ChartPlugin from '../../core/models/ChartPlugin';
import ChartMetadata from '../../core/models/ChartMetadata';
import transformProps from '../transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: 'Bullet Chart',
  description: '',
  credits: ['http://nvd3.org'],
  thumbnail,
});

export default class BulletChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('../ReactNVD3.js'),
    });
  }
}
