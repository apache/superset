import { BulletChartPlugin } from '@superset-ui/legacy-preset-chart-nvd3';
import Stories from './Stories';

new BulletChartPlugin().configure({ key: 'bullet' }).register();

export default {
  examples: [...Stories],
};
