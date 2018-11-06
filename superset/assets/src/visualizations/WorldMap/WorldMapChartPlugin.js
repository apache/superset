import { t } from '@superset-ui/translation';
import ChartPlugin from '../core/models/ChartPlugin';
import ChartMetadata from '../core/models/ChartMetadata';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: t('World Map'),
  description: '',
  credits: ['http://datamaps.github.io/'],
  thumbnail,
});

export default class WorldMapChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('./ReactWorldMap.js'),
    });
  }
}
