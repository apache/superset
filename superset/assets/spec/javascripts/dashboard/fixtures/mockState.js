import chartQueries from './mockChartQueries';
import { dashboardLayout } from './mockDashboardLayout';
import dashboardInfo from './mockDashboardInfo';
import dashboardState from './mockDashboardState';
import messageToasts from '../../messageToasts/mockMessageToasts';
import datasources from '../../../fixtures/mockDatasource';
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
