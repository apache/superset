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
/* eslint camelcase: 0 */
import { getControlsState, getFormDataFromControls } from '../store';
import * as actions from '../actions/exploreActions';

export default function exploreReducer(state = {}, action) {
  const actionHandlers = {
    [actions.TOGGLE_FAVE_STAR]() {
      return {
        ...state,
        isStarred: action.isStarred,
      };
    },
    [actions.POST_DATASOURCE_STARTED]() {
      return {
        ...state,
        isDatasourceMetaLoading: true,
      };
    },
    [actions.SET_DATASOURCE]() {
      return {
        ...state,
        datasource: action.datasource,
      };
    },
    [actions.FETCH_DATASOURCES_STARTED]() {

      return {
        ...state,
        isDatasourcesLoading: true,
      };
    },
    [actions.FETCH_DATASOURCES_SUCCEEDED]() {

      return {
        ...state,
        isDatasourcesLoading: false,
      };
    },
    [actions.FETCH_DATASOURCES_FAILED]() {

      return {
        ...state,
        isDatasourcesLoading: false,
        controlPanelAlert: action.error,
      };
    },
    [actions.SET_DATASOURCES]() {
      return {
        ...state,
        datasources: action.datasources,
      };
    },
    [actions.REMOVE_CONTROL_PANEL_ALERT]() {
      return {
        ...state,
        controlPanelAlert: null,
      };
    },
    [actions.SET_FIELD_VALUE]() {
      const controls = Object.assign({}, state.controls);
      const control = Object.assign({}, controls[action.controlName]);
      control.value = action.value;
      control.validationErrors = action.validationErrors;
      controls[action.controlName] = control;
      const changes = {
        controls,
      };
      if (control.renderTrigger) {
        changes.triggerRender = true;
      } else {
        changes.triggerRender = false;
      }
      const newState = {
        ...state,
        ...changes,
      };
      return newState;
    },
    [actions.SET_EXPLORE_CONTROLS]() {
      return {
        ...state,
        controls: getControlsState(state, action.formData),
      };
    },
    [actions.UPDATE_CHART_TITLE]() {
      const updatedSlice = Object.assign({}, state.slice, { slice_name: action.slice_name });
      return {
        ...state,
        slice: updatedSlice,
      };
    },
    [actions.RESET_FIELDS]() {
      return {
        ...state,
        controls: getControlsState(state, getFormDataFromControls(state.controls)),
      };
    },
    [actions.CREATE_NEW_SLICE]() {
      return {
        ...state,
        slice: action.slice,
        controls: getControlsState(state, action.form_data),
        can_add: action.can_add,
        can_download: action.can_download,
        can_overwrite: action.can_overwrite,
      };
    },
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
