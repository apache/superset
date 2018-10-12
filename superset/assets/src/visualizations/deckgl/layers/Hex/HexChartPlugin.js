import ChartPlugin from '../../../core/models/ChartPlugin';
import ChartMetadata from '../../../core/models/ChartMetadata';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  name: 'deck.gl 3D Hexagon',
  description: '',
  credits: ['https://uber.github.io/deck.gl'],
  thumbnail,
});

export default class HexChartPlugin extends ChartPlugin {
  constructor() {
    super({
      metadata,
      loadChart: () => import('./Hex.jsx'),
    });
  }
}
