import { ScatterPlotChartPlugin, LegacyScatterPlotChartPlugin } from '@superset-ui/preset-chart-xy';
import { SCATTER_PLOT_PLUGIN_TYPE, SCATTER_PLOT_PLUGIN_LEGACY_TYPE } from './constants';
import { withKnobs } from '@storybook/addon-knobs';

new LegacyScatterPlotChartPlugin().configure({ key: SCATTER_PLOT_PLUGIN_LEGACY_TYPE }).register();
new ScatterPlotChartPlugin().configure({ key: SCATTER_PLOT_PLUGIN_TYPE }).register();

export default {
  title: 'Chart Plugins|preset-chart-xy/ScatterPlot',
  decorators: [withKnobs],
};

export { default as basic } from './stories/basic';
export { default as bubble } from './stories/bubble';
export { default as legacy } from './stories/legacy';
