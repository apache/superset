import IframeChartPlugin from '@superset-ui/legacy-plugin-chart-iframe';
import IframeStories from './IframeStories';

new IframeChartPlugin().configure({ key: 'iframe' }).register();

export default {
  examples: [...IframeStories],
};
