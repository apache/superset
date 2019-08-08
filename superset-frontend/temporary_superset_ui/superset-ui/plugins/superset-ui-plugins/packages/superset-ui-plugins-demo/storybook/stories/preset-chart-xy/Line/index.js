import { LineChartPlugin as LegacyLineChartPlugin } from '../../../../../superset-ui-preset-chart-xy/esm/legacy';
import { LineChartPlugin } from '../../../../../superset-ui-preset-chart-xy';
import BasicStories from './stories/basic';
import FlushStories from './stories/flush';
import QueryStories from './stories/query';
import LegacyStories from './stories/legacy';
import MissingStories from './stories/missing';
import TimeShiftStories from './stories/timeShift';
import { LINE_PLUGIN_TYPE, LINE_PLUGIN_LEGACY_TYPE } from './constants';

new LegacyLineChartPlugin().configure({ key: LINE_PLUGIN_LEGACY_TYPE }).register();
new LineChartPlugin().configure({ key: LINE_PLUGIN_TYPE }).register();

export default {
  examples: [
    ...BasicStories,
    ...FlushStories,
    ...MissingStories,
    ...TimeShiftStories,
    ...LegacyStories,
    ...QueryStories,
  ],
};
