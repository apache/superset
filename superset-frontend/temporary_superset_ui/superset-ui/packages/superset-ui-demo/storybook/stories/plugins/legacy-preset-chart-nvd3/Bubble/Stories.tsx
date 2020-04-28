import { BubbleChartPlugin } from '@superset-ui/legacy-preset-chart-nvd3';

new BubbleChartPlugin().configure({ key: 'bubble' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-preset-chart-nvd3/Bubble',
};

export { basic } from './stories/basic';
