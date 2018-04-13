import { combineReducers } from 'redux';
import shortid from 'shortid';

import charts from '../../chart/chartReducer';
import saveModal from './saveModalReducer';
import explore from './exploreReducer';

export default combineReducers({
  charts,
  saveModal,
  explore,
  impressionId: () => (shortid.generate()),
});
