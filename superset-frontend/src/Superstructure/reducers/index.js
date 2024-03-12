import { combineReducers } from 'redux';

import charts from 'src/components/Chart/chartReducer';
import dataMask from 'src/dataMask/reducer';
import dashboardInfo from 'src/dashboard/reducers/dashboardInfo';
import dashboardState from 'src/dashboard/reducers/dashboardState';
import dashboardFilters from 'src/dashboard/reducers/dashboardFilters';
import nativeFilters from 'src/dashboard/reducers/nativeFilters';
import datasources from 'src/dashboard/reducers/datasources';
import sliceEntities from 'src/dashboard/reducers/sliceEntities';
import dashboardLayout from 'src/dashboard/reducers/undoableDashboardLayout';
import messageToasts from 'src/components/MessageToasts/reducers';

const impressionId = (state = '') => state;

export default combineReducers({
  user: (state = null) => state,
  common: (state = null) => state,
  charts,
  datasources,
  dashboardInfo,
  dashboardFilters,
  dataMask,
  nativeFilters,
  dashboardState,
  dashboardLayout,
  impressionId,
  messageToasts,
  sliceEntities,
});
