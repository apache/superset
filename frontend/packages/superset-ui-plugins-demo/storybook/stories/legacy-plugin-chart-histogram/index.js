import HistogramChartPlugin from '../../../../superset-ui-legacy-plugin-chart-histogram';
import Stories from './Stories';

new HistogramChartPlugin().configure({ key: 'histogram' }).register();

export default {
  examples: [...Stories],
};
