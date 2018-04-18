import undoable, { includeAction } from 'redux-undo';
import {
  UPDATE_COMPONENTS,
  DELETE_COMPONENT,
  CREATE_COMPONENT,
  CREATE_TOP_LEVEL_TABS,
  DELETE_TOP_LEVEL_TABS,
  RESIZE_COMPONENT,
  MOVE_COMPONENT,
  HANDLE_COMPONENT_DROP,
} from '../actions/dashboardLayout';

import dashboardLayout from './dashboardLayout';

const undoableLayout = undoable(dashboardLayout, {
  limit: 15,
  filter: includeAction([
    UPDATE_COMPONENTS,
    DELETE_COMPONENT,
    CREATE_COMPONENT,
    CREATE_TOP_LEVEL_TABS,
    DELETE_TOP_LEVEL_TABS,
    RESIZE_COMPONENT,
    MOVE_COMPONENT,
    HANDLE_COMPONENT_DROP,
  ]),
});

export default undoableLayout;
