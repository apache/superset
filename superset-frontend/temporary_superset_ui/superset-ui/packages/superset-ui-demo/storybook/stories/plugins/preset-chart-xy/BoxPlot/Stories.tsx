import { BoxPlotChartPlugin, LegacyBoxPlotChartPlugin } from '@superset-ui/preset-chart-xy';
import { BOX_PLOT_PLUGIN_LEGACY_TYPE, BOX_PLOT_PLUGIN_TYPE } from './constants';

new LegacyBoxPlotChartPlugin().configure({ key: BOX_PLOT_PLUGIN_LEGACY_TYPE }).register();
new BoxPlotChartPlugin().configure({ key: BOX_PLOT_PLUGIN_TYPE }).register();

export default {
  title: 'Chart Plugins|preset-chart-xy/BoxPlot',
};

export { basic, horizontal } from './stories/Basic';
export { legacy } from './stories/Legacy';
