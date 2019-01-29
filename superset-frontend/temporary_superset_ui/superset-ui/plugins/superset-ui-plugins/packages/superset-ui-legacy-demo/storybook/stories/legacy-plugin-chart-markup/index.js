import MarkupChartPlugin from '@superset-ui/legacy-plugin-chart-markup';
import MarkupStories from './MarkupStories';

new MarkupChartPlugin().configure({ key: 'markup' }).register();

export default {
  examples: [...MarkupStories],
};
