import TableChartPlugin from '../../../../superset-ui-plugin-chart-table/src';
import TableChartPluginLegacy from '../../../../superset-ui-plugin-chart-table/src/legacy';
import Stories from './Stories';

new TableChartPlugin().configure({ key: 'table2' }).register();
new TableChartPluginLegacy().configure({ key: 'table2-legacy' }).register();

export default {
  examples: [...Stories],
};
