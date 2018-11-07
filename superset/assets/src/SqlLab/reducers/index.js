import { combineReducers } from 'redux';

import sqlLab from './sqlLab';
import messageToasts from '../../messageToasts/reducers/index';
import common from './common';

export default combineReducers({
  sqlLab,
  messageToasts,
  common,
});
