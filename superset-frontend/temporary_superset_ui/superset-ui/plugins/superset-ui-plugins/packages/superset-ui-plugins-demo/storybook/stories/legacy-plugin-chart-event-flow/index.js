import EventFlowChartPlugin from '../../../../superset-ui-legacy-plugin-chart-event-flow';
import Stories from './Stories';

new EventFlowChartPlugin().configure({ key: 'event-flow' }).register();

export default {
  examples: [...Stories],
};
