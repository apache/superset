import { ScatterPlotPlugin as LegacyScatterPlotPlugin } from '../../../../../superset-ui-preset-chart-xy/src/legacy';
import { ScatterPlotPlugin } from '../../../../../superset-ui-preset-chart-xy/src';
import BasicStories from './stories/basic';
import BubbleStories from './stories/bubble';
import LegacyStories from './stories/legacy';
import { SCATTER_PLOT_PLUGIN_TYPE, SCATTER_PLOT_PLUGIN_LEGACY_TYPE } from './constants';

new LegacyScatterPlotPlugin().configure({ key: SCATTER_PLOT_PLUGIN_LEGACY_TYPE }).register();
new ScatterPlotPlugin().configure({ key: SCATTER_PLOT_PLUGIN_TYPE }).register();

export default {
  examples: [...BasicStories, ...BubbleStories, ...LegacyStories],
};
