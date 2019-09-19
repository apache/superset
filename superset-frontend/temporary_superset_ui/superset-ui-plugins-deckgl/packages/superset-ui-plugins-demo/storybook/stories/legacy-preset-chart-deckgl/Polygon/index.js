import { PolygonChartPlugin } from '../../../../../superset-ui-legacy-preset-chart-deckgl/src';
import Stories from './Stories';

new PolygonChartPlugin().configure({ key: 'deck_polygon' }).register();

export default {
  examples: [...Stories],
};
