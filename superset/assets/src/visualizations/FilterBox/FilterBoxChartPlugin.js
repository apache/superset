import { t } from '@superset-ui/translation';
import ChartPlugin from '../core/models/ChartPlugin';
import ChartMetadata from '../core/models/ChartMetadata';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: t('Filter Box'),
  description: 'A multi filter, multi-choice filter box to make dashboards interactive',
  thumbnail,
});

export default class FilterBoxChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('./FilterBox.jsx'),
    });
  }
}
