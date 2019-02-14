import CalendarChartPlugin from '../../../../superset-ui-legacy-plugin-chart-calendar/src';
import Stories from './Stories';

new CalendarChartPlugin().configure({ key: 'calendar' }).register();

export default {
  examples: [...Stories],
};
