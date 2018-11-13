import ChartPlugin from '../core/models/ChartPlugin';
import ChartMetadata from '../core/models/ChartMetadata';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: 'Country Map',
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
