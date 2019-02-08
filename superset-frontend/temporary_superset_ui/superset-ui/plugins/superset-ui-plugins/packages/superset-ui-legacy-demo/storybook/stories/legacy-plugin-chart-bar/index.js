import { BarChartPlugin } from '@superset-ui/legacy-preset-chart-nvd3';
import Stories from './Stories';

new BarChartPlugin().configure({ key: 'bar' }).register();

export default {
  examples: [...Stories],
};
