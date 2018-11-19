import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: t('Country Map'),
  description: '',
  credits: ['https://bl.ocks.org/john-guerra'],
  thumbnail,
});

export default class CountryMapChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      transformProps,
      loadChart: () => import('./ReactCountryMap.js'),
    });
  }
}
