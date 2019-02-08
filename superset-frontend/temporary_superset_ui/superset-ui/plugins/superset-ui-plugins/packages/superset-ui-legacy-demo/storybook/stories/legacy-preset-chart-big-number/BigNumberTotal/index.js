import { BigNumberTotalChartPlugin } from '@superset-ui/legacy-preset-chart-big-number';
import Stories from './Stories';

new BigNumberTotalChartPlugin().configure({ key: 'big-number-total' }).register();

export default {
  examples: [...Stories],
};
