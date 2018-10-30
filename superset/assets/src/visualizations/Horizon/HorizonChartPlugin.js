import ChartPlugin from '../core/models/ChartPlugin';
import ChartMetadata from '../core/models/ChartMetadata';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: 'Horizon Chart',
  description: '',
  credits: ['http://kmandov.github.io/d3-horizon-chart/'],
  thumbnail,
});

export default class HorizonChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('./HorizonChart.jsx'),
    });
  }
}
