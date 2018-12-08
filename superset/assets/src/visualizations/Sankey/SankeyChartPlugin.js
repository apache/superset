import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: t('Sankey Diagram'),
  description: '',
  credits: ['https://github.com/d3/d3-sankey'],
  thumbnail,
});

export default class SankeyChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('./ReactSankey.js'),
    });
  }
}
