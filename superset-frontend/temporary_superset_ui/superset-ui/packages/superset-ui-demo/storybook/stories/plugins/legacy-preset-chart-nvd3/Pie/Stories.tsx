import { PieChartPlugin } from '@superset-ui/legacy-preset-chart-nvd3';

new PieChartPlugin().configure({ key: 'pie' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-preset-chart-nvd3/Pie',
};

export { basic } from './stories/basic';
export { noData } from './stories/noData';
