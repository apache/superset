import ChordChartPlugin from '@superset-ui/legacy-plugin-chart-chord';
import ChordStories from './ChordStories';

new ChordChartPlugin().configure({ key: 'chord' }).register();

export default {
  examples: [...ChordStories],
};
