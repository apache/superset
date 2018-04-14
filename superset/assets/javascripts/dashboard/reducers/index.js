import { combineReducers } from 'redux';
import shortid from 'shortid';

import charts from '../../chart/chartReducer';
import dashboardState from './dashboard';
import datasources from './datasources';
import sliceEntities from './sliceEntities';
import dashboardLayout from '../v2/reducers/index';
import messageToasts from '../v2/reducers/messageToasts';

const dashboardInfo = (state = {}) => (state);

const impressionId = (state = '') => {
  if (!state) {
    state = shortid.generate();
  }
  return state;
};

export default combineReducers({
  charts,
  datasources,
  sliceEntities,
  dashboardInfo,
  dashboardState,
  dashboardLayout,
  messageToasts,
  impressionId,
});
