import ChartPlugin from '../../../core/models/ChartPlugin';
import ChartMetadata from '../../../core/models/ChartMetadata';
import thumbnail from './images/thumbnail.png';
import transformProps from '../../transformProps';

const metadata = new ChartMetadata({
  name: 'deck.gl Path',
  description: '',
  credits: ['https://uber.github.io/deck.gl'],
  thumbnail,
});

export default class PathChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      loadChart: () => import('./Path.jsx'),
      transformProps,
    });
  }
}
