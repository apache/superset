import { DistBarChartPlugin } from '../../../../../superset-ui-legacy-preset-chart-nvd3';
import Stories from './Stories';

new DistBarChartPlugin().configure({ key: 'dist-bar' }).register();

export default {
  examples: [...Stories],
};
