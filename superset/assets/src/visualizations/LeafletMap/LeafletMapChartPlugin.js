import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: t('LeafletMap'),
  description: '',
  thumbnail,
});

export default class LeafletMapChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      loadChart: () => import('./leaflet_map.js'),
    });
  }
}
