import HeatmapChartPlugin from '@superset-ui/legacy-plugin-chart-heatmap';
import Stories from './Stories';

new HeatmapChartPlugin().configure({ key: 'heatmap' }).register();

export default {
  examples: [...Stories],
};
