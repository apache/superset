import ParallelCoordinatesChartPlugin from '@superset-ui/legacy-plugin-chart-parallel-coordinates';
import Stories from './Stories';

new ParallelCoordinatesChartPlugin().configure({ key: 'parallel-coordinates' }).register();

export default {
  examples: [...Stories],
};
