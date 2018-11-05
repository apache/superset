import { t } from '@superset-ui/translation';
import ChartPlugin from '../../core/models/ChartPlugin';
import ChartMetadata from '../../core/models/ChartMetadata';
import transformProps from '../transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: t('Bar Chart'),
  description: t('A bar chart where the x axis is time'),
  credits: ['http://nvd3.org'],
  thumbnail,
});

export default class DistBarChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('../ReactNVD3.js'),
    });
  }
}
