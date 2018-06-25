import { combineReducers } from 'redux';

import charts from '../../chart/chartReducer';
import saveModal from './saveModalReducer';
import explore from './exploreReducer';

const impressionId = (state = '') => (state);

export default combineReducers({
  charts,
  saveModal,
  explore,
  impressionId,
});
