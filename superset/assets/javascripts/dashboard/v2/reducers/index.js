import undoable, { distinctState } from 'redux-undo';

import dashboardLayout from './dashboardLayout';

export const undoableLayout = undoable(dashboardLayout, {
  limit: 15,
  filter: distinctState(),
});

export default undoableLayout;
