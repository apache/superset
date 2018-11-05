import { t } from '@superset-ui/translation';
import ChartPlugin from '../core/models/ChartPlugin';
import ChartMetadata from '../core/models/ChartMetadata';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: t('Event Flow'),
  description: '',
  credits: ['https://github.com/williaster/data-ui'],
  thumbnail,
});

export default class EventFlowChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      loadTransformProps: () => import('./transformProps.js'),
      loadChart: () => import('./EventFlow.jsx'),
    });
  }
}
