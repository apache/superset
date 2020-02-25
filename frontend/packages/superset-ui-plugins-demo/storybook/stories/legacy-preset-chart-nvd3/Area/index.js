import { AreaChartPlugin } from '../../../../../superset-ui-legacy-preset-chart-nvd3';
import Stories from './Stories';

new AreaChartPlugin().configure({ key: 'area' }).register();

export default {
  examples: [...Stories],
};
