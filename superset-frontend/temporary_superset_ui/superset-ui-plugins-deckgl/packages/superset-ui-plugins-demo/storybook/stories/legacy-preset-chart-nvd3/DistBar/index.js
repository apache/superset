import { DistBarChartPlugin } from '../../../../../superset-ui-legacy-preset-chart-nvd3';
import Stories from './Stories';
import ManyBarStories from './ManyBarStories';

new DistBarChartPlugin().configure({ key: 'dist-bar' }).register();

export default {
  examples: [...Stories, ...ManyBarStories],
};
