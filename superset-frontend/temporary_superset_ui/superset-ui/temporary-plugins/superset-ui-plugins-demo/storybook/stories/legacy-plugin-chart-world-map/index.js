import WorldMapChartPlugin from '../../../../superset-ui-legacy-plugin-chart-world-map';
import Stories from './Stories';

new WorldMapChartPlugin().configure({ key: 'world-map' }).register();

export default {
  examples: [...Stories],
};
