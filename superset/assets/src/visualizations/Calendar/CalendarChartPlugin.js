import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
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
