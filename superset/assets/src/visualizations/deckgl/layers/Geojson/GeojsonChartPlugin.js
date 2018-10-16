import ChartPlugin from '../../../core/models/ChartPlugin';
import ChartMetadata from '../../../core/models/ChartMetadata';
import thumbnail from './images/thumbnail.png';
import transformProps from '../../transformProps';

const metadata = new ChartMetadata({
  name: 'deck.gl Geojson',
  description: '',
  credits: ['https://uber.github.io/deck.gl'],
  thumbnail,
});

export default class GeojsonChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      loadChart: () => import('./Geojson.jsx'),
      transformProps,
    });
  }
}
