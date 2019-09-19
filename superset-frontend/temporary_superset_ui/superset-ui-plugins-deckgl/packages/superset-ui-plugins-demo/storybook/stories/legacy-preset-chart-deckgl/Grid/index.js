import { GridChartPlugin } from '../../../../../superset-ui-legacy-preset-chart-deckgl';
import Stories from './Stories';

new GridChartPlugin().configure({ key: 'deck_grid' }).register();

export default {
  examples: [...Stories],
};
