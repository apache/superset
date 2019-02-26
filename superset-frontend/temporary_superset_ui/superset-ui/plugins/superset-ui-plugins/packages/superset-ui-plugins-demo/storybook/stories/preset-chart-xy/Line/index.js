import { LineChartPlugin } from '../../../../../superset-ui-preset-chart-xy/src';
import Stories from './Stories';

new LineChartPlugin().configure({ key: 'line2' }).register();

export default {
  examples: [...Stories],
};
