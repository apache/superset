import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: t('Heatmap'),
  description: '',
  credits: ['http://bl.ocks.org/mbostock/3074470'],
  thumbnail,
});

export default class HeatmapChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('./ReactHeatmap.js'),
    });
  }
}
