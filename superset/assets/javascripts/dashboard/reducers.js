import { combineReducers } from 'redux';
import d3 from 'd3';

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
  if (dashboard.position_json) {
    dashboard.position_json.forEach((position) => {
      dashboard.posDict[position.slice_id] = position;
    });
  }
  dashboard.slices.forEach((slice, index) => {
    const sliceId = slice.slice_id;
    let pos = dashboard.posDict[sliceId];
    if (!pos) {
      pos = {
        col: (index * 4 + 1) % 12,
        row: Math.floor((index) / 3) * 4,
        size_x: 4,
        size_y: 4,
      };
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

      let filters;
      const { sliceId, col, vals, merge, refresh } = action;
      const filterKeys = ['__from', '__to', '__time_col',
        '__time_grain', '__time_origin', '__granularity'];
      if (filterKeys.indexOf(col) >= 0 ||
        selectedSlice.formData.groupby.indexOf(col) !== -1) {
        if (!(sliceId in state.filters)) {
          filters = { ...state.filters, [sliceId]: {} };
        }

        let newFilter = {};
        if (state.filters[sliceId] && !(col in state.filters[sliceId]) || !merge) {
          newFilter = { ...state.filters[sliceId], [col]: vals };
          // d3.merge pass in array of arrays while some value form filter components
          // from and to filter box require string to be process and return
        } else if (state.filters[sliceId][col] instanceof Array) {
          newFilter[col] = d3.merge([state.filters[sliceId][col], vals]);
        } else {
          newFilter[col] = d3.merge([[state.filters[sliceId][col]], vals])[0] || '';
        }
        filters = { ...state.filters, [sliceId]: newFilter };
      }
      return { ...state, filters, refresh };
    },
    [actions.CLEAR_FILTER]() {
      const newFilters = { ...state.filters };
      delete newFilters[action.sliceId];
      return { ...state, filter: newFilters, refresh: true };
    },
    [actions.REMOVE_FILTER]() {
      const newFilters = { ...state.filters };
      const { sliceId, col, vals } = action;

      if (sliceId in state.filters) {
        if (col in state.filters[sliceId]) {
          const a = [];
          newFilters[sliceId][col].forEach(function (v) {
            if (vals.indexOf(v) < 0) {
              a.push(v);
            }
          });
          newFilters[sliceId][col] = a;
        }
      }
      return { ...state, filter: newFilters, refresh: true };
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
});
