import { BubbleChartPlugin } from '@superset-ui/legacy-preset-chart-nvd3';
import Stories from './Stories';

new BubbleChartPlugin().configure({ key: 'bubble' }).register();

export default {
  examples: [...Stories],
};
