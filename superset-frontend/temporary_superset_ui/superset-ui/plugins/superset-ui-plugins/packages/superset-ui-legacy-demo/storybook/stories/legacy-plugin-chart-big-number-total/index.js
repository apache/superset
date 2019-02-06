import BigNumberTotalChartPlugin from '@superset-ui/legacy-plugin-chart-big-number-total';
import Stories from './Stories';

new BigNumberTotalChartPlugin().configure({ key: 'big-number-total' }).register();

export default {
  examples: [...Stories],
};
