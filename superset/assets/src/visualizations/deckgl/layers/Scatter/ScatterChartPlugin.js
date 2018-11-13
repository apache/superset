import ChartPlugin from '../../../core/models/ChartPlugin';
import ChartMetadata from '../../../core/models/ChartMetadata';
import thumbnail from './images/thumbnail.png';
import transformProps from '../../transformProps';

const metadata = new ChartMetadata({
  name: 'deck.gl Scatterplot',
  description: '',
  credits: ['https://uber.github.io/deck.gl'],
  thumbnail,
});

export default class ScatterChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      loadChart: () => import('./Scatter.jsx'),
      transformProps,
    });
  }
}
