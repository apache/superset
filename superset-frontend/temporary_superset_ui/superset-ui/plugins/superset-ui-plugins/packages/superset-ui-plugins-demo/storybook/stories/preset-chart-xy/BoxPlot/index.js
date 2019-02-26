import { BoxPlotChartPlugin } from '../../../../../superset-ui-preset-chart-xy/src';
import Stories from './Stories';

new BoxPlotChartPlugin().configure({ key: 'box-plot2' }).register();

export default {
  examples: [...Stories],
};
