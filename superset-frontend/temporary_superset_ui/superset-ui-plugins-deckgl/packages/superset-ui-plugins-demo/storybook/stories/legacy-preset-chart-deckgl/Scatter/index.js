import { ScatterChartPlugin } from '../../../../../superset-ui-legacy-preset-chart-deckgl';
import Stories from './Stories';

new ScatterChartPlugin().configure({ key: 'deck_scatter' }).register();

export default {
  examples: [...Stories],
};
