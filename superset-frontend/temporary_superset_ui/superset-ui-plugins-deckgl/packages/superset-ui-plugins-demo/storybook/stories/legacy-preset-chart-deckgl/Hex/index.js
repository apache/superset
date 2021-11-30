import { HexChartPlugin } from '../../../../../superset-ui-legacy-preset-chart-deckgl';
import Stories from './Stories';

new HexChartPlugin().configure({ key: 'deck_hex' }).register();

export default {
  examples: [...Stories],
};
