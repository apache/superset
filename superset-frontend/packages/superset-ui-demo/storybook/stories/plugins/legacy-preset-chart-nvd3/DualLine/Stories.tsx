import { DualLineChartPlugin } from '@superset-ui/legacy-preset-chart-nvd3';

new DualLineChartPlugin().configure({ key: 'dual-line' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-preset-chart-nvd3/DualLine',
};

export { basic } from './stories/basic';
export { verifyConsistentColors } from './stories/verifyConsistentColors';
