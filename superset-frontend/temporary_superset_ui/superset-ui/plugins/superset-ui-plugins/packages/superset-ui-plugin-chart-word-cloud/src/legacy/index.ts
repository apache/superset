import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
import buildQuery from '../buildQuery';
import transformProps from './transformProps';
import thumbnail from '../images/thumbnail.png';
import { LegacyWordCloudFormData } from './types';

const metadata = new ChartMetadata({
  credits: ['https://github.com/jasondavies/d3-cloud'],
  description: '',
  name: t('Word Cloud'),
  thumbnail,
  useLegacyApi: true,
});

export default class WordCloudChartPlugin extends ChartPlugin<LegacyWordCloudFormData> {
  constructor() {
    super({
      buildQuery,
      loadChart: () => import('../chart/WordCloud'),
      metadata,
      transformProps,
    });
  }
}
