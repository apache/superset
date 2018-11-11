import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: t('MapBox'),
  description: '',
  credits: ['https://www.mapbox.com/mapbox-gl-js/api/'],
  thumbnail,
});

export default class MapBoxChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      loadTransformProps: () => import('./transformProps.js'),
      loadChart: () => import('./MapBox.jsx'),
    });
  }
}
