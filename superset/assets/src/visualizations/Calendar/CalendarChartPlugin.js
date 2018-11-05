import { t } from '@superset-ui/translation';
import ChartPlugin from '../core/models/ChartPlugin';
import ChartMetadata from '../core/models/ChartMetadata';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: t('Calendar Heatmap'),
  description: '',
  credits: ['https://github.com/wa0x6e/cal-heatmap'],
  thumbnail,
});

export default class ChordChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('./ReactCalendar.js'),
    });
  }
}
