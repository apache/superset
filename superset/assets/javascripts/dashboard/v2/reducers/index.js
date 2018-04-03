import { combineReducers } from 'redux';
import undoable, { distinctState } from 'redux-undo';

import dashboardLayout from './dashboardLayout';
import editMode from './editMode';

const undoableLayout = undoable(dashboardLayout, {
  limit: 15,
  filter: distinctState(),
});

export default combineReducers({
  dashboardLayout: undoableLayout,
  editMode,
});
