import { CompareChartPlugin } from '../../../../../superset-ui-legacy-preset-chart-nvd3';
import Stories from './Stories';

new CompareChartPlugin().configure({ key: 'compare' }).register();

export default {
  examples: [...Stories],
};
