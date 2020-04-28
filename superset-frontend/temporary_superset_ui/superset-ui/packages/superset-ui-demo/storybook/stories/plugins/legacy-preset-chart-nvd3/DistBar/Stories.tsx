import { DistBarChartPlugin } from '@superset-ui/legacy-preset-chart-nvd3';

new DistBarChartPlugin().configure({ key: 'dist-bar' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-preset-chart-nvd3/DistBar',
};

export { basic } from './stories/basic';
export { manyBars } from './stories/manyBars';
