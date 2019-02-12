import <%= packageLabel %>ChartPlugin from '../../../../superset-ui-legacy-plugin-chart-<%= packageName %>';
import Stories from './Stories';

new <%= packageLabel %>ChartPlugin().configure({ key: '<%= packageName %>' }).register();

export default {
  examples: [...Stories],
};
