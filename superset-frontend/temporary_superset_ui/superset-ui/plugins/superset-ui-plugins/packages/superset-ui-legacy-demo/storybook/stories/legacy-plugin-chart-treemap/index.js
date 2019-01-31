import TreemapChartPlugin from '@superset-ui/legacy-plugin-chart-treemap/src/index';
import Stories from './Stories';

new TreemapChartPlugin().configure({ key: 'treemap' }).register();

export default {
  examples: [...Stories],
};
