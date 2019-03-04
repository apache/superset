import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
import buildQuery from './buildQuery';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: t('Word Cloud'),
  description: '',
  credits: ['https://github.com/jasondavies/d3-cloud'],
  thumbnail,
});

export default class WordCloudChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      buildQuery,
      transformProps,
      loadChart: () => import('./ReactWordCloud.js'),
    });
  }
}
