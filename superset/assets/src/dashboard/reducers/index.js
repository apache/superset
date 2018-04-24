import { combineReducers } from 'redux';

import charts from '../../chart/chartReducer';
import dashboardState from './dashboardState';
import datasources from './datasources';
import sliceEntities from './sliceEntities';
import dashboardLayout from '../reducers/undoableDashboardLayout';
import messageToasts from '../reducers/messageToasts';

const dashboardInfo = (state = {}) => state;
const impressionId = (state = '') => state;

export default combineReducers({
  charts,
  datasources,
  dashboardInfo,
  dashboardState,
  dashboardLayout,
  impressionId,
  messageToasts,
  sliceEntities,
});
