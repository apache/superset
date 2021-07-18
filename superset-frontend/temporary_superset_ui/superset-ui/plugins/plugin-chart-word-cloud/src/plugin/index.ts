import { t, ChartMetadata, ChartPlugin } from '@superset-ui/core';
import transformProps from '../legacyPlugin/transformProps';
import buildQuery from './buildQuery';
import { WordCloudFormData } from '../types';
import thumbnail from '../images/thumbnail.png';
import example1 from '../images/Word_Cloud.jpg';
import example2 from '../images/Word_Cloud_2.jpg';
import controlPanel from './controlPanel';
import configureEncodable from '../configureEncodable';

configureEncodable();

const metadata = new ChartMetadata({
  category: t('Ranking'),
  credits: ['https://github.com/jasondavies/d3-cloud'],
  description: t(
    'Visualizes the words in a column that appear the most often. Bigger font corresponds to higher frequency.',
  ),
  exampleGallery: [{ url: example1 }, { url: example2 }],
  name: t('Word Cloud'),
  tags: [t('Aesthetic'), t('Categorical'), t('Comparison'), t('Highly-used'), t('Text')],
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
