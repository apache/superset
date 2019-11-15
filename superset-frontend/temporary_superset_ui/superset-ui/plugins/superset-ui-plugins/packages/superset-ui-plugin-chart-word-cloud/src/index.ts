import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
import buildQuery from './buildQuery';
import WordCloudFormData from './WordCloudFormData';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  credits: ['https://github.com/jasondavies/d3-cloud'],
  description: '',
  name: t('Word Cloud'),
  thumbnail,
});

export default class WordCloudChartPlugin extends ChartPlugin<WordCloudFormData> {
  constructor() {
    super({
      buildQuery,
      loadChart: () => import('./WordCloud'),
      metadata,
      transformProps,
    });
  }
}
