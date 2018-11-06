import { t } from '@superset-ui/translation';
import ChartPlugin from '../core/models/ChartPlugin';
import ChartMetadata from '../core/models/ChartMetadata';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: t('Nightingale Rose Chart'),
  description: '',
  thumbnail,
});

export default class RoseChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('./ReactRose.js'),
    });
  }
}
