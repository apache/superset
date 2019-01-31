import RoseChartPlugin from '@superset-ui/legacy-plugin-chart-rose';
import Stories from './Stories';

new RoseChartPlugin().configure({ key: 'rose' }).register();

export default {
  examples: [...Stories],
};
