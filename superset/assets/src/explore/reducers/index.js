import { combineReducers } from 'redux';

import charts from '../../chart/chartReducer';
import saveModal from './saveModalReducer';
import explore from './exploreReducer';
import featureFlags from '../../featureFlags';
import messageToasts from '../../messageToasts/reducers';

const impressionId = (state = '') => state;

export default combineReducers({
  featureFlags,
  charts,
  saveModal,
  explore,
  impressionId,
  messageToasts,
});
