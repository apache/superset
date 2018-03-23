import { combineReducers } from 'redux';
import undoable, { distinctState } from 'redux-undo';

import dashboard from './dashboard';

const undoableDashboard = undoable(dashboard, {
  limit: 10,
  filter: distinctState(),
});

export default combineReducers({
  dashboard: undoableDashboard,
});
