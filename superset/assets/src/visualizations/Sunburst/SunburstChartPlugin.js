import ChartPlugin from '../core/models/ChartPlugin';
import ChartMetadata from '../core/models/ChartMetadata';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: 'Sunburst Chart',
  description: '',
  credits: ['https://bl.ocks.org/kerryrodden/7090426'],
  thumbnail,
});

export default class SunburstChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('./ReactSunburst.js'),
    });
  }
}
