import { t } from '@superset-ui/translation';
import ChartPlugin from '../../../core/models/ChartPlugin';
import ChartMetadata from '../../../core/models/ChartMetadata';
import thumbnail from './images/thumbnail.png';
import transformProps from '../../transformProps';

const metadata = new ChartMetadata({
  name: t('deck.gl Polygon'),
  description: '',
  credits: ['https://uber.github.io/deck.gl'],
  thumbnail,
});

export default class PolygonChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      loadChart: () => import('./Polygon.jsx'),
      transformProps,
    });
  }
}
