import PivotTableChartPlugin from '@superset-ui/legacy-plugin-chart-pivot-table';
import Stories from './Stories';

new PivotTableChartPlugin().configure({ key: 'pivot-table' }).register();

export default {
  examples: [...Stories],
};
