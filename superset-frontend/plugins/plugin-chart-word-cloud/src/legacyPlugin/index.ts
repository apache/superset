import { t, ChartMetadata, ChartPlugin } from '@superset-ui/core';
import transformProps from './transformProps';
import buildQuery from '../plugin/buildQuery';
import thumbnail from '../images/thumbnail.png';
import { LegacyWordCloudFormData } from './types';

const metadata = new ChartMetadata({
  credits: ['https://github.com/jasondavies/d3-cloud'],
  description: '',
  name: t('Word Cloud'),
  thumbnail,
  useLegacyApi: true,
});

export default class LegacyWordCloudChartPlugin extends ChartPlugin<LegacyWordCloudFormData> {
  constructor() {
    super({
      buildQuery,
      loadChart: () => import('../chart/WordCloud'),
      metadata,
      transformProps,
    });
  }
}
