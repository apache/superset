import ChartPlugin from '../core/models/ChartPlugin';
import ChartMetadata from '../core/models/ChartMetadata';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: 'Word Cloud',
  description: '',
  credits: ['https://github.com/jasondavies/d3-cloud'],
  thumbnail,
});

export default class WordCloudChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('./ReactWordCloud.js'),
    });
  }
}
