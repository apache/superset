import IframeChartPlugin from '@superset-ui/legacy-plugin-chart-iframe';
import Stories from './Stories';

new IframeChartPlugin().configure({ key: 'iframe' }).register();

export default {
  examples: [...Stories],
};
