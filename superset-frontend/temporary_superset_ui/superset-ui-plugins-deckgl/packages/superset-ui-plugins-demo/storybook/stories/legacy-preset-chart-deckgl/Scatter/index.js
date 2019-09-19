import { ScatterChartPlugin } from '../../../../../superset-ui-legacy-preset-chart-deckgl/src';
import Stories from './Stories';

new ScatterChartPlugin().configure({ key: 'deck_scatter' }).register();

export default {
  examples: [...Stories],
};
