import undoable, { includeAction } from 'redux-undo';
import { UNDO_LIMIT } from '../util/constants';
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

export default undoable(dashboardLayout, {
  // +1 because length of history seems max out at limit - 1
  // +1 again so we can detect if we've exceeded the limit
  limit: UNDO_LIMIT + 2,
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
