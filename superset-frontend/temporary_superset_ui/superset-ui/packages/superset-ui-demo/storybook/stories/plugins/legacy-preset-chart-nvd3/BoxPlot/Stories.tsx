import { BoxPlotChartPlugin } from '@superset-ui/legacy-preset-chart-nvd3';

new BoxPlotChartPlugin().configure({ key: 'box-plot' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-preset-chart-nvd3/BoxPlot',
};

export { basic } from './stories/basic';
