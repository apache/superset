import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  canBeAnnotationTypes: ['EVENT', 'INTERVAL'],
  description: '',
  name: t('ECharts Basic'),
  thumbnail,
  useLegacyApi: true,
});

export default class EChartsChartPlugin extends ChartPlugin {
  constructor() {
    super({
      loadChart: () => import('./ReactEChartsBasic.jsx'),
      metadata,
    });
  }
}