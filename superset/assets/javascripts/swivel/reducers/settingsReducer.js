import { combineReducers } from 'redux';
import undoable from 'redux-undo';

import { querySettingsReducer } from './querySettingsReducer';
import { vizSettingsReducer } from './vizSettingsReducer';

import * as global from '../actions/globalActions';
import * as queryActions from '../actions/querySettingsActions';

// This function is used to keep the undo history clean.
// Changes to the ERROR state should be ignored. The "CONFIGURE_SPLIT"
// logic is required since adding a split is a 2 step process
// (ADD and CONFIGURE) without user interaction for the initial configuration,
// which therefore should not be added to the UNDO history.
export function includeInUndoHistory() {
  return (action, currentState, previousState) => {
    if (currentState === previousState) {
      return false;
    } else if (action.type === global.CLEAR_HISTORY) {
      return false;
    } else if (action.type === queryActions.CONFIGURE_SPLIT) {
      const oldSplit = previousState.query.splits.find(x => x.id === action.split.id);
      if (oldSplit && oldSplit.justAdded) {
        return false;
      }
    }
    return true;
  };
}

// Overriding the default initTypes (e.g. NOOP) will prevent the history to
// be reset on reload (or opening a new tab)
export const settingsReducer = undoable(
    combineReducers({ query: querySettingsReducer, viz: vizSettingsReducer }),
  {
    filter: includeInUndoHistory(),
    initTypes: [global.CLEAR_HISTORY],
    limit: 50,
  });

