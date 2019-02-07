import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
import thumbnail from './images/thumbnail.png';
import transformProps from './transformProps';

const metadata = new ChartMetadata({
  name: t('LeafletMap'),
  description: '',
  thumbnail,
});

export default class LeafletMapChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('./ReactLeafletMap.js')
    });
  }
}
