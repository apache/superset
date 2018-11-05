import { t } from '@superset-ui/translation';
import ChartPlugin from '../core/models/ChartPlugin';
import ChartMetadata from '../core/models/ChartMetadata';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: t('Force-directed Graph'),
  description: '',
  credits: ['http://bl.ocks.org/d3noob/5141278'],
  thumbnail,
});

export default class ForceDirectedChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('./ReactForceDirected.js'),
    });
  }
}
