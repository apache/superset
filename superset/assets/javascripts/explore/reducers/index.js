import { combineReducers } from 'redux';

import chart from './chartReducer';
import saveModal from './saveModalReducer';
import explore from './exploreReducer';

export default combineReducers({
  chart,
  saveModal,
  explore,
});
