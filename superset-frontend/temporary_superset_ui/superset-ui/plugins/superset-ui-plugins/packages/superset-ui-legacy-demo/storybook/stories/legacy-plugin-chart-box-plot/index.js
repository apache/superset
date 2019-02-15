import BoxPlotChartPlugin from '../../../../superset-ui-legacy-plugin-chart-box-plot/src';
import Stories from './Stories';

new BoxPlotChartPlugin().configure({ key: 'box-plot2' }).register();

export default {
  examples: [...Stories],
};
