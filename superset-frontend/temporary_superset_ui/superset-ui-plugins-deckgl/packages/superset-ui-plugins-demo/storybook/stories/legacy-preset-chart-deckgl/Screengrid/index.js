import { ScreengridChartPlugin } from '../../../../../superset-ui-legacy-preset-chart-deckgl';
import Stories from './Stories';

new ScreengridChartPlugin().configure({ key: 'deck_screengrid' }).register();

export default {
  examples: [...Stories],
};
