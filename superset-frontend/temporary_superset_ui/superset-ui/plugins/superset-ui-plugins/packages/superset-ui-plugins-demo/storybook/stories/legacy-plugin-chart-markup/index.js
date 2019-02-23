import MarkupChartPlugin from '../../../../superset-ui-legacy-plugin-chart-markup';
import Stories from './Stories';

new MarkupChartPlugin().configure({ key: 'markup' }).register();

export default {
  examples: [...Stories],
};
