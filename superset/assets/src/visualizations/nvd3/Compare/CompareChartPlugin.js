import { t } from '@superset-ui/translation';
import ChartPlugin from '../../core/models/ChartPlugin';
import ChartMetadata from '../../core/models/ChartMetadata';
import transformProps from '../transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: t('Time-series Percent Change'),
  description: t('A line chart component where you can compare the % change over time'),
  credits: ['http://nvd3.org'],
  thumbnail,
});

export default class CompareChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('../ReactNVD3.js'),
    });
  }
}
