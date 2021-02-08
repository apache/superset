import { CompareChartPlugin } from '@superset-ui/legacy-preset-chart-nvd3';

new CompareChartPlugin().configure({ key: 'compare' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-preset-chart-nvd3/Compare',
};

export { basic } from './stories/basic';
export { timeFormat } from './stories/timeFormat';
