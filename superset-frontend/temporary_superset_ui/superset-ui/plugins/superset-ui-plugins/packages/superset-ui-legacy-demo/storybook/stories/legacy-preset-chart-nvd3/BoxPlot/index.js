import { BoxPlotChartPlugin } from '../../../../../superset-ui-legacy-preset-chart-nvd3';
import Stories from './Stories';

new BoxPlotChartPlugin().configure({ key: 'box-plot' }).register();

export default {
  examples: [...Stories],
};
