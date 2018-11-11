import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: t('Parallel Coordinates'),
  description: '',
  credits: ['https://syntagmatic.github.io/parallel-coordinates'],
  thumbnail,
});

export default class ParallelCoordinatesChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('./ReactParallelCoordinates.js'),
    });
  }
}
