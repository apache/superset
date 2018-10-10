import ChartPlugin from '../core/models/ChartPlugin';
import ChartMetadata from '../core/models/ChartMetadata';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: 'Event Flow',
  description: '',
  credits: ['https://github.com/williaster/data-ui'],
  thumbnail,
});

export default class CountryMapChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('./EventFlow.jsx'),
    });
  }
}
