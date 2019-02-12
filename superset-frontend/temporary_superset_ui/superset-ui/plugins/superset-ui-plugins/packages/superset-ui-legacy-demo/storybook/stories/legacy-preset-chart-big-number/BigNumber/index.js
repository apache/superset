import { BigNumberChartPlugin } from '../../../../../superset-ui-legacy-preset-chart-big-number';
import Stories from './Stories';

new BigNumberChartPlugin().configure({ key: 'big-number' }).register();

export default {
  examples: [...Stories],
};
