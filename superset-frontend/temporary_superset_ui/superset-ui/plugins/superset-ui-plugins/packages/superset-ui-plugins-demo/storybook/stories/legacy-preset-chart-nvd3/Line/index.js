import { LineChartPlugin } from '../../../../../superset-ui-legacy-preset-chart-nvd3';
import Stories from './Stories';

new LineChartPlugin().configure({ key: 'line' }).register();

export default {
  examples: [...Stories],
};
