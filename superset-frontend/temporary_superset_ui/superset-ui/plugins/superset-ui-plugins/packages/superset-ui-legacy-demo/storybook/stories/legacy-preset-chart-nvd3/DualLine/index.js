import { DualLineChartPlugin } from '@superset-ui/legacy-preset-chart-nvd3';
import Stories from './Stories';

new DualLineChartPlugin().configure({ key: 'dual-line' }).register();

export default {
  examples: [...Stories],
};
