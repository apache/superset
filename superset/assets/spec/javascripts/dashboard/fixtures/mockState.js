import chartQueries from './mockChartQueries';
import { dashboardLayout } from './mockDashboardLayout';
import dashboardInfo from './mockDashboardInfo';
import dashboardState from './mockDashboardState';
import messageToasts from './mockMessageToasts';
import datasources from './mockDatasource';
import sliceEntities from './mockSliceEntities';

export default {
  datasources,
  sliceEntities,
  charts: chartQueries,
  dashboardInfo,
  dashboardState,
  dashboardLayout,
  messageToasts,
  impressionId: 'mock_impression_id',
};
