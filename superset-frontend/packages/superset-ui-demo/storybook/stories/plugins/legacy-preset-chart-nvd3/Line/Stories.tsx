import { LineChartPlugin } from '@superset-ui/legacy-preset-chart-nvd3';

new LineChartPlugin().configure({ key: 'line' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-preset-chart-nvd3/Line',
};

export { basic } from './stories/basic';
export { markers } from './stories/markers';
export { logScale } from './stories/logScale';
export { yAxisBounds } from './stories/yAxisBounds';
