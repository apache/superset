import { ArcChartPlugin } from '../../../../../superset-ui-legacy-preset-chart-deckgl';
import Stories from './Stories';

new ArcChartPlugin().configure({ key: 'deck_arc' }).register();

export default {
  examples: [...Stories],
};
