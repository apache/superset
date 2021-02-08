import { BarChartPlugin } from '@superset-ui/legacy-preset-chart-nvd3';

new BarChartPlugin().configure({ key: 'bar' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-preset-chart-nvd3/Bar',
};

export { basic } from './stories/basic';
export { barWithValues } from './stories/barWithValues';
export { barWithPositiveAndNegativeValues } from './stories/barWithPositiveAndNegativeValues';
export { stackedBarWithValues } from './stories/stackedBarWithValues';
