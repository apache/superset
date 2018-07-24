/* eslint-disable camelcase */
import {
  ADD_SLICE,
  CHANGE_FILTER,
  ON_CHANGE,
  ON_SAVE,
  REMOVE_SLICE,
  SET_EDIT_MODE,
  SET_MAX_UNDO_HISTORY_EXCEEDED,
  SET_UNSAVED_CHANGES,
  TOGGLE_BUILDER_PANE,
  TOGGLE_EXPAND_SLICE,
  TOGGLE_FAVE_STAR,
  UPDATE_CSS,
} from '../actions/dashboardState';

export default function dashboardStateReducer(state = {}, action) {
  const actionHandlers = {
    [UPDATE_CSS]() {
      return { ...state, css: action.css };
    },
    [ADD_SLICE]() {
      const updatedSliceIds = new Set(state.sliceIds);
      updatedSliceIds.add(action.slice.slice_id);
      return {
        ...state,
        sliceIds: Array.from(updatedSliceIds),
      };
    },
    [REMOVE_SLICE]() {
      const sliceId = action.sliceId;
      const updatedSliceIds = new Set(state.sliceIds);
      updatedSliceIds.delete(sliceId);

      const key = sliceId;
      // if this slice is a filter
      const newFilter = { ...state.filters };
      let refresh = false;
      if (state.filters[key]) {
        delete newFilter[key];
        refresh = true;
      }
      return {
        ...state,
        sliceIds: Array.from(updatedSliceIds),
        filters: newFilter,
        refresh,
      };
    },
    [TOGGLE_FAVE_STAR]() {
      return { ...state, isStarred: action.isStarred };
    },
    [SET_EDIT_MODE]() {
      return {
        ...state,
        editMode: action.editMode,
        showBuilderPane: !!action.editMode,
      };
    },
    [SET_MAX_UNDO_HISTORY_EXCEEDED]() {
      const { maxUndoHistoryExceeded = true } = action.payload;
      return { ...state, maxUndoHistoryExceeded };
    },
    [TOGGLE_BUILDER_PANE]() {
      return { ...state, showBuilderPane: !state.showBuilderPane };
    },
    [TOGGLE_EXPAND_SLICE]() {
      const updatedExpandedSlices = { ...state.expandedSlices };
      const sliceId = action.sliceId;
      if (updatedExpandedSlices[sliceId]) {
        delete updatedExpandedSlices[sliceId];
      } else {
        updatedExpandedSlices[sliceId] = true;
      }
      return { ...state, expandedSlices: updatedExpandedSlices };
    },
    [ON_CHANGE]() {
      return { ...state, hasUnsavedChanges: true };
    },
    [ON_SAVE]() {
      return {
        ...state,
        hasUnsavedChanges: false,
        maxUndoHistoryExceeded: false,
        editMode: false,
      };
    },

    [CHANGE_FILTER]() {
      const hasSelectedFilter = state.sliceIds.includes(action.chart.id);
      if (!hasSelectedFilter) {
        return state;
      }

      let filters = state.filters;
      const { chart, col, vals: nextVals, merge, refresh } = action;
      const sliceId = chart.id;
      const filterKeys = [
        '__time_range',
        '__time_col',
        '__time_grain',
        '__time_origin',
        '__granularity',
      ];
      if (
        filterKeys.indexOf(col) >= 0 ||
        action.chart.formData.groupby.indexOf(col) !== -1
      ) {
        let newFilter = {};
        if (!(sliceId in filters)) {
          // if no filters existed for the slice, set them
          newFilter = { [col]: nextVals };
        } else if ((filters[sliceId] && !(col in filters[sliceId])) || !merge) {
          // If no filters exist for this column, or we are overwriting them
          newFilter = { ...filters[sliceId], [col]: nextVals };
        } else if (filters[sliceId][col] instanceof Array) {
          newFilter[col] = [...filters[sliceId][col], ...nextVals];
        } else {
          newFilter[col] = [filters[sliceId][col], ...nextVals];
        }
        filters = { ...filters, [sliceId]: newFilter };

        // remove any empty filters so they don't pollute the logs
        Object.keys(filters).forEach(chartId => {
          Object.keys(filters[chartId]).forEach(column => {
            if (
              !filters[chartId][column] ||
              filters[chartId][column].length === 0
            ) {
              delete filters[chartId][column];
            }
          });
          if (Object.keys(filters[chartId]).length === 0) {
            delete filters[chartId];
          }
        });
      }
      return { ...state, filters, refresh };
    },
    [SET_UNSAVED_CHANGES]() {
      const { hasUnsavedChanges } = action.payload;
      return { ...state, hasUnsavedChanges };
    },
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
