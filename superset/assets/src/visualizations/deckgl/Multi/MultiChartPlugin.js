import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
import thumbnail from './images/thumbnail.png';
import transformProps from '../transformProps';

const metadata = new ChartMetadata({
  name: t('deck.gl Multiple Layers'),
  description: '',
  credits: ['https://uber.github.io/deck.gl'],
  thumbnail,
});

export default class MultiChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      loadChart: () => import('./Multi.jsx'),
      transformProps,
    });
  }
}
