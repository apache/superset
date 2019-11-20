import WordCloudChartPlugin from '../../../../superset-ui-plugin-chart-word-cloud/src';
import LegacyWordCloudChartPlugin from '../../../../superset-ui-plugin-chart-word-cloud/esm/legacy';
import Stories from './Stories';

new WordCloudChartPlugin().configure({ key: 'word-cloud2' }).register();
new LegacyWordCloudChartPlugin().configure({ key: 'legacy-word-cloud2' }).register();

export default {
  examples: [...Stories],
};
