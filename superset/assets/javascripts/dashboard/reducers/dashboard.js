import d3 from 'd3';

import * as actions from '../actions/dashboard';
import { alterInArr, addToArr, removeFromArr } from '../../reduxUtils';

export default function dashboard(state = {}, action) {
  const actionHandlers = {
    [actions.UPDATE_DASHBOARD_TITLE]() {
      const newDashboard = { ...state.dashboard, dashboard_title: action.title };
      return { ...state, dashboard: newDashboard };
    },
    [actions.ADD_SLICE]() {
      const updatedSliceIds = new Set(state.dashboard.sliceIds);
      updatedSliceIds.add(action.slice.slice_id);
      return {
        ...state,
        dashboard: { ...state.dashboard, sliceIds: updatedSliceIds }
      };
    },
    // [actions.UPDATE_DASHBOARD_LAYOUT]() {
    //   const newDashboard = { ...state.dashboard, layout: action.layout };
    //   return { ...state, dashboard: newDashboard };
    // },
    [actions.REMOVE_SLICE]() {
      const sliceId = action.sliceId;
      const updatedSliceIds = new Set(state.dashboard.sliceIds);
      updatedSliceIds.delete(sliceId);

      const key = String(sliceId);
      // if this slice is a filter
      const newFilter = { ...state.filters };
      let refresh = false;
      if (state.filters[key]) {
        delete newFilter[key];
        refresh = true;
      }
      return {
        ...state,
        dashboard: { ...state.dashboard, sliceIds: updatedSliceIds },
        filters: newFilter,
        refresh,
      };
    },
    [actions.TOGGLE_FAVE_STAR]() {
      return { ...state, isStarred: action.isStarred };
    },
    [actions.SET_EDIT_MODE]() {
      return { ...state, editMode: action.editMode };
    },
    [actions.TOGGLE_BUILDER_PANE]() {
      return { ...state, showBuilderPane: !state.showBuilderPane };
    },
    [actions.TOGGLE_EXPAND_SLICE]() {
      const updatedExpandedSlices = { ...state.dashboard.metadata.expanded_slices };
      const sliceId = action.slice.slice_id;
      if (action.isExpanded) {
        updatedExpandedSlices[sliceId] = true;
      } else {
        delete updatedExpandedSlices[sliceId];
      }
      const metadata = { ...state.dashboard.metadata, expanded_slices: updatedExpandedSlices };
      const newDashboard = { ...state.dashboard, metadata };
      return { ...state, dashboard: newDashboard };
    },
    [actions.ON_CHANGE]() {
      return { ...state, hasUnsavedChanges: true };
    },
    [actions.ON_SAVE]() {
      return { ...state, hasUnsavedChanges: false };
    },

    // filters
    [actions.ADD_FILTER]() {
      const hasSelectedFilter = state.dashboard.sliceIds.has(action.chart.slice_id);
      if (!hasSelectedFilter) {
        return state;
      }

      let filters = state.filters;
      const { chart, col, vals, merge, refresh } = action;
      const sliceId = chart.slice_id;
      const filterKeys = ['__from', '__to', '__time_col',
        '__time_grain', '__time_origin', '__granularity'];
      if (filterKeys.indexOf(col) >= 0 ||
        action.chart.formData.groupby.indexOf(col) !== -1) {
        let newFilter = {};
        if (!(sliceId in filters)) {
          // Straight up set the filters if none existed for the slice
          newFilter = { [col]: vals };
        } else if (filters[sliceId] && !(col in filters[sliceId]) || !merge) {
          newFilter = { ...filters[sliceId], [col]: vals };
          // d3.merge pass in array of arrays while some value form filter components
          // from and to filter box require string to be process and return
        } else if (filters[sliceId][col] instanceof Array) {
          newFilter[col] = d3.merge([filters[sliceId][col], vals]);
        } else {
          newFilter[col] = d3.merge([[filters[sliceId][col]], vals])[0] || '';
        }
        filters = { ...filters, [sliceId]: newFilter };
      }
      return { ...state, filters, refresh };
    },
    [actions.REMOVE_FILTER]() {
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
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
};