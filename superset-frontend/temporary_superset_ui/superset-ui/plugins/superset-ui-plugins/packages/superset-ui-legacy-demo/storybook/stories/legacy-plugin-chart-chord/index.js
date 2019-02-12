import ChordChartPlugin from '../../../../superset-ui-legacy-plugin-chart-chord/src';
import Stories from './Stories';

new ChordChartPlugin().configure({ key: 'chord' }).register();

export default {
  examples: [...Stories],
};
