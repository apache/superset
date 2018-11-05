import { t } from '@superset-ui/translation';
import ChartPlugin from '../../core/models/ChartPlugin';
import ChartMetadata from '../../core/models/ChartMetadata';
import transformProps from '../transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: t('Dual Line Chart'),
  description: '',
  credits: ['http://nvd3.org'],
  thumbnail,
});

export default class DualLineChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('../ReactNVD3.js'),
    });
  }
}
