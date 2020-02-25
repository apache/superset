import SunburstChartPlugin from '../../../../superset-ui-legacy-plugin-chart-sunburst';
import Stories from './Stories';

new SunburstChartPlugin().configure({ key: 'sunburst' }).register();

export default {
  examples: [...Stories],
};
