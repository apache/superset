import ChordChartPlugin from '@superset-ui/legacy-plugin-chart-chord';
import Stories from './Stories';

new ChordChartPlugin().configure({ key: 'chord' }).register();

export default {
  examples: [...Stories],
};
