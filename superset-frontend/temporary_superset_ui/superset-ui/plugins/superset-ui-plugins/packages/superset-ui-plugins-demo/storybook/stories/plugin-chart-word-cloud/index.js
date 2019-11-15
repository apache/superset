import WordCloudChartPlugin from '../../../../superset-ui-plugin-chart-word-cloud';
import Stories from './Stories';

new WordCloudChartPlugin().configure({ key: 'word-cloud' }).register();

export default {
  examples: [...Stories],
};
