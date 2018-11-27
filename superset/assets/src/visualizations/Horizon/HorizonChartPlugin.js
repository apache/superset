import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: t('Horizon Chart'),
  description: '',
  credits: ['http://kmandov.github.io/d3-horizon-chart/'],
  thumbnail,
});

export default class HorizonChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('./HorizonChart.jsx'),
    });
  }
}
