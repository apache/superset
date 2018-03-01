import { combineReducers } from 'redux';
import d3 from 'd3';
import shortid from 'shortid';

import charts, { chart } from '../chart/chartReducer';
import * as actions from './actions';
import { getParam } from '../modules/utils';
import { alterInArr, removeFromArr } from '../reduxUtils';
import { applyDefaultFormData } from '../explore/stores/store';
import { getColorFromScheme } from '../modules/colors';

export function getInitialState(bootstrapData) {
  const { user_id, datasources, common } = bootstrapData;
  delete common.locale;
  delete common.language_pack;

  const dashboard = { ...bootstrapData.dashboard_data };
  let filters = {};
  try {
    // allow request parameter overwrite dashboard metadata
    filters = JSON.parse(getParam('preselect_filters') || dashboard.metadata.default_filters);
  } catch (e) {
    //
  }

  // Priming the color palette with user's label-color mapping provided in
  // the dashboard's JSON metadata
  if (dashboard.metadata && dashboard.metadata.label_colors) {
    const colorMap = dashboard.metadata.label_colors;
    for (const label in colorMap) {
      getColorFromScheme(label, null, colorMap[label]);
    }
  }

  dashboard.posDict = {};
  dashboard.layout = [];
  if (Array.isArray(dashboard.position_json)) {
    dashboard.position_json.forEach((position) => {
      dashboard.posDict[position.slice_id] = position;
    });
  } else {
    dashboard.position_json = [];
  }

  const lastRowId = Math.max(0, Math.max.apply(null,
    dashboard.position_json.map(pos => (pos.row + pos.size_y))));
  let newSliceCounter = 0;
  dashboard.slices.forEach((slice) => {
    const sliceId = slice.slice_id;
    let pos = dashboard.posDict[sliceId];
    if (!pos) {
      // append new slices to dashboard bottom, 3 slices per row
      pos = {
        col: (newSliceCounter % 3) * 16 + 1,
        row: lastRowId + Math.floor(newSliceCounter / 3) * 16,
        size_x: 16,
        size_y: 16,
      };
      newSliceCounter++;
    }

    dashboard.layout.push({
      i: String(sliceId),
      x: pos.col - 1,
      y: pos.row,
      w: pos.size_x,
      minW: 2,
      h: pos.size_y,
    });
  });

  // will use charts action/reducers to handle chart render
  const initCharts = {};
  dashboard.slices.forEach((slice) => {
    const chartKey = 'slice_' + slice.slice_id;
    initCharts[chartKey] = { ...chart,
      chartKey,
      slice_id: slice.slice_id,
      form_data: slice.form_data,
      formData: applyDefaultFormData(slice.form_data),
    };
  });

  // also need to add formData for dashboard.slices
  dashboard.slices = dashboard.slices.map(slice =>
    ({ ...slice, formData: applyDefaultFormData(slice.form_data) }),
  );

  return {
    charts: initCharts,
    dashboard: { filters, dashboard, userId: user_id, datasources, common, editMode: false },
  };
}

export const dashboard = function (state = {}, action) {
  const actionHandlers = {
    [actions.UPDATE_DASHBOARD_TITLE]() {
      const newDashboard = { ...state.dashboard, dashboard_title: action.title };
      return { ...state, dashboard: newDashboard };
    },
    [actions.UPDATE_DASHBOARD_LAYOUT]() {
      const newDashboard = { ...state.dashboard, layout: action.layout };
      return { ...state, dashboard: newDashboard };
    },
    [actions.REMOVE_SLICE]() {
      const key = String(action.slice.slice_id);
      const newLayout = state.dashboard.layout.filter(reactPos => (reactPos.i !== key));
      const newDashboard = removeFromArr(state.dashboard, 'slices', action.slice, 'slice_id');
      // if this slice is a filter
      const newFilter = { ...state.filters };
      let refresh = false;
      if (state.filters[key]) {
        delete newFilter[key];
        refresh = true;
      }
      return {
        ...state,
        dashboard: { ...newDashboard, layout: newLayout },
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

    // filters
    [actions.ADD_FILTER]() {
      const selectedSlice = state.dashboard.slices
        .find(slice => (slice.slice_id === action.sliceId));
      if (!selectedSlice) {
        return state;
      }

      let filters = state.filters;
      const { sliceId, col, vals, merge, refresh } = action;
      const filterKeys = ['__from', '__to', '__time_col',
        '__time_grain', '__time_origin', '__granularity'];
      if (filterKeys.indexOf(col) >= 0 ||
        selectedSlice.formData.groupby.indexOf(col) !== -1) {
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
    [actions.CLEAR_FILTER]() {
      const newFilters = { ...state.filters };
      delete newFilters[action.sliceId];
      return { ...state, filter: newFilters, refresh: true };
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

    // slice reducer
    [actions.UPDATE_SLICE_NAME]() {
      const newDashboard = alterInArr(
        state.dashboard, 'slices',
        action.slice, { slice_name: action.sliceName },
        'slice_id');
      return { ...state, dashboard: newDashboard };
    },
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
};

export default combineReducers({
  charts,
  dashboard,
  impressionId: () => (shortid.generate()),
});
