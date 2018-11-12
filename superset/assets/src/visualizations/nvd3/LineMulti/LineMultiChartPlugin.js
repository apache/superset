import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: t('Multiple Line Charts'),
  description: '',
  credits: ['http://nvd3.org'],
  thumbnail,
});

export default class LineChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      loadChart: () => import('./LineMulti.jsx'),
    });
  }
}
