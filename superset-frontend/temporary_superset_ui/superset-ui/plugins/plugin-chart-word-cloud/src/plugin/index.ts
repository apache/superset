import { t, ChartMetadata, ChartPlugin } from '@superset-ui/core';
import transformProps from '../legacyPlugin/transformProps';
import buildQuery from './buildQuery';
import { WordCloudFormData } from '../types';
import thumbnail from '../images/thumbnail.png';
import controlPanel from './controlPanel';
import configureEncodable from '../configureEncodable';

configureEncodable();

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
      loadChart: () => import('../chart/WordCloud'),
      metadata,
      transformProps,
      controlPanel,
    });
  }
}
