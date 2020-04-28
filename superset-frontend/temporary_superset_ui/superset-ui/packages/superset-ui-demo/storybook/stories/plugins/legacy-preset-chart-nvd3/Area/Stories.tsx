import { AreaChartPlugin } from '@superset-ui/legacy-preset-chart-nvd3';

new AreaChartPlugin().configure({ key: 'area' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-preset-chart-nvd3/Area',
};

export { stacked } from './stories/stacked';
export { stackedWithYAxisBounds, stackedWithYAxisBoundsMinOnly } from './stories/stackedWithBounds';
export { expanded } from './stories/expanded';
export { controlsShown } from './stories/controlsShown';
