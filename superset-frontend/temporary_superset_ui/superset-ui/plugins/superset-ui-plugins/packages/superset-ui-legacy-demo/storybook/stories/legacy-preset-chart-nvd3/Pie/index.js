import { PieChartPlugin } from '@superset-ui/legacy-preset-chart-nvd3';
import Stories from './Stories';

new PieChartPlugin().configure({ key: 'pie' }).register();

export default {
  examples: [...Stories],
};
