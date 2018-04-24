/* eslint-disable camelcase */
import { merge as mergeArray } from 'd3';

import {
  ADD_SLICE,
  ADD_FILTER,
  ON_CHANGE,
  ON_SAVE,
  REMOVE_SLICE,
  REMOVE_FILTER,
  SET_EDIT_MODE,
  SET_UNSAVED_CHANGES,
  TOGGLE_BUILDER_PANE,
  TOGGLE_EXPAND_SLICE,
  TOGGLE_FAVE_STAR,
  UPDATE_DASHBOARD_TITLE,
} from '../actions/dashboardState';

export default function dashboardStateReducer(state = {}, action) {
  const actionHandlers = {
    [UPDATE_DASHBOARD_TITLE]() {
      return { ...state, title: action.title };
    },
    [ADD_SLICE]() {
      const updatedSliceIds = new Set(state.sliceIds);
      updatedSliceIds.add(action.slice.slice_id);
      return {
        ...state,
        sliceIds: updatedSliceIds,
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
        sliceIds: updatedSliceIds,
        filters: newFilter,
        refresh,
      };
    },
    [TOGGLE_FAVE_STAR]() {
      return { ...state, isStarred: action.isStarred };
    },
    [SET_EDIT_MODE]() {
      return { ...state, editMode: action.editMode };
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
      return { ...state, hasUnsavedChanges: false };
    },

    // filters
    [ADD_FILTER]() {
      const hasSelectedFilter = state.sliceIds.has(action.chart.id);
      if (!hasSelectedFilter) {
        return state;
      }

      let filters = state.filters;
      const { chart, col, vals, merge, refresh } = action;
      const sliceId = chart.id;
      const filterKeys = [
        '__from',
        '__to',
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
          // Straight up set the filters if none existed for the slice
          newFilter = { [col]: vals };
        } else if ((filters[sliceId] && !(col in filters[sliceId])) || !merge) {
          newFilter = { ...filters[sliceId], [col]: vals };
          // d3.merge pass in array of arrays while some value form filter components
          // from and to filter box require string to be process and return
        } else if (filters[sliceId][col] instanceof Array) {
          newFilter[col] = mergeArray([filters[sliceId][col], vals]);
        } else {
          newFilter[col] = mergeArray([[filters[sliceId][col]], vals])[0] || '';
        }
        filters = { ...filters, [sliceId]: newFilter };
      }
      return { ...state, filters, refresh };
    },
    [REMOVE_FILTER]() {
      const { sliceId, col, vals, refresh } = action;
      const excluded = new Set(vals);
      const valFilter = val => !excluded.has(val);

      let filters = state.filters;
      // Have to be careful not to modify the dashboard state so that
      // the render actually triggers
      if (sliceId in state.filters && col in state.filters[sliceId]) {
        const newFilter = filters[sliceId][col].filter(valFilter);
        filters = { ...filters, [sliceId]: newFilter };
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
