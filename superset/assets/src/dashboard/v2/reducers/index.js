import undoable, { distinctState } from 'redux-undo';

import dashboardLayout from './dashboardLayout';

export default undoable(dashboardLayout, {
  limit: 15,
  filter: distinctState(),
});
