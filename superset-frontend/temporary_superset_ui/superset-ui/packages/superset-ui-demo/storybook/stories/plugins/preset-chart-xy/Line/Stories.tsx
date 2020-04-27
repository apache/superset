import { LineChartPlugin, LegacyLineChartPlugin } from '@superset-ui/preset-chart-xy';
import { LINE_PLUGIN_TYPE, LINE_PLUGIN_LEGACY_TYPE } from './constants';
import { withKnobs } from '@storybook/addon-knobs';

new LegacyLineChartPlugin().configure({ key: LINE_PLUGIN_LEGACY_TYPE }).register();
new LineChartPlugin().configure({ key: LINE_PLUGIN_TYPE }).register();

export default {
  title: 'Chart Plugins|preset-chart-xy/Line',
  decorators: [withKnobs],
};

export { default as basic } from './stories/basic';
export { default as withLabelFlush } from './stories/flush';
export { default as withMissingData } from './stories/missing';
export { default as legacyShim } from './stories/legacy';
export { default as withTimeShift } from './stories/timeShift';
export { default as query } from './stories/query';
