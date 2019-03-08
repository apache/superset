import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
import thumbnail from './images/thumbnail.png';
import transformProps from '../../transformProps';

const metadata = new ChartMetadata({
  name: t('deck.gl Arc'),
  description: '',
  credits: ['https://uber.github.io/deck.gl'],
  thumbnail,
});

export default class ArcChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      loadChart: () => import('./Arc.jsx'),
      transformProps,
    });
  }
}
