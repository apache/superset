import {
  ScatterPlotChartPlugin,
  LegacyScatterPlotChartPlugin,
} from '../../../../../superset-ui-preset-chart-xy';
import BasicStories from './stories/basic';
import BubbleStories from './stories/bubble';
import LegacyStories from './stories/legacy';
import { SCATTER_PLOT_PLUGIN_TYPE, SCATTER_PLOT_PLUGIN_LEGACY_TYPE } from './constants';

new LegacyScatterPlotChartPlugin().configure({ key: SCATTER_PLOT_PLUGIN_LEGACY_TYPE }).register();
new ScatterPlotChartPlugin().configure({ key: SCATTER_PLOT_PLUGIN_TYPE }).register();

export default {
  examples: [...BasicStories, ...BubbleStories, ...LegacyStories],
};
