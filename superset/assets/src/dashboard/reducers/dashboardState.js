/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/* eslint-disable camelcase */
import {
  ADD_SLICE,
  CHANGE_FILTER,
  ON_CHANGE,
  ON_SAVE,
  REMOVE_SLICE,
  SET_COLOR_SCHEME,
  SET_EDIT_MODE,
  SET_MAX_UNDO_HISTORY_EXCEEDED,
  SET_UNSAVED_CHANGES,
  SHOW_BUILDER_PANE,
  TOGGLE_EXPAND_SLICE,
  TOGGLE_FAVE_STAR,
  UPDATE_CSS,
  SET_REFRESH_FREQUENCY,
} from '../actions/dashboardState';
import { BUILDER_PANE_TYPE } from '../util/constants';

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
        builderPaneType: action.editMode
          ? BUILDER_PANE_TYPE.ADD_COMPONENTS
          : BUILDER_PANE_TYPE.NONE,
      };
    },
    [SET_MAX_UNDO_HISTORY_EXCEEDED]() {
      const { maxUndoHistoryExceeded = true } = action.payload;
      return { ...state, maxUndoHistoryExceeded };
    },
    [SHOW_BUILDER_PANE]() {
      return { ...state, builderPaneType: action.builderPaneType };
    },
    [SET_COLOR_SCHEME]() {
      return {
        ...state,
        colorScheme: action.colorScheme,
        updatedColorScheme: true,
      };
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
        builderPaneType: BUILDER_PANE_TYPE.NONE,
        updatedColorScheme: false,
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
      return { ...state, filters, refresh };
    },
    [SET_UNSAVED_CHANGES]() {
      const { hasUnsavedChanges } = action.payload;
      return { ...state, hasUnsavedChanges };
    },
    [SET_REFRESH_FREQUENCY]() {
      return {
        ...state,
        refreshFrequency: action.refreshFrequency,
        hasUnsavedChanges: true,
      };
    },
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
