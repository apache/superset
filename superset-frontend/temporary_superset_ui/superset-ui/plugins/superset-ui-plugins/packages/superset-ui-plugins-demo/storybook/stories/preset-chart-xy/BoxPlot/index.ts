import {
  BoxPlotChartPlugin,
  LegacyBoxPlotChartPlugin,
} from '../../../../../superset-ui-preset-chart-xy';
import Stories from './stories/Basic';
import LegacyStories from './stories/Legacy';
import { BOX_PLOT_PLUGIN_LEGACY_TYPE, BOX_PLOT_PLUGIN_TYPE } from './constants';

new LegacyBoxPlotChartPlugin().configure({ key: BOX_PLOT_PLUGIN_LEGACY_TYPE }).register();
new BoxPlotChartPlugin().configure({ key: BOX_PLOT_PLUGIN_TYPE }).register();

export default {
  examples: [...Stories, ...LegacyStories],
};
