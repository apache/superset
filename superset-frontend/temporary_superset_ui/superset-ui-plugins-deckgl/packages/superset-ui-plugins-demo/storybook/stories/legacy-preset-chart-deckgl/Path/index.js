import { PathChartPlugin } from '../../../../../superset-ui-legacy-preset-chart-deckgl';
import Stories from './Stories';

new PathChartPlugin().configure({ key: 'deck_path' }).register();

export default {
  examples: [...Stories],
};
