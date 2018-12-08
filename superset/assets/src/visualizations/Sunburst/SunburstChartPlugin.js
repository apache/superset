import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: t('Sunburst Chart'),
  description: '',
  credits: ['https://bl.ocks.org/kerryrodden/7090426'],
  thumbnail,
});

export default class SunburstChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('./ReactSunburst.js'),
    });
  }
}
