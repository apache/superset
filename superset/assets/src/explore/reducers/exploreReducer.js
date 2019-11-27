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
import { getControlsState } from '../store';
import { getControlState, getFormDataFromControls } from '../controlUtils';
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
      let new_form_data = state.form_data;
      if (action.controlName === 'viz_type') {
        new_form_data = JSON.parse(JSON.stringify(new_form_data));
        // Update state's vizType if we are switching to a new visualization
        new_form_data.viz_type = action.value;
      }

      // These errors are reported from the Control components
      let errors = action.validationErrors || [];
      const vizType = new_form_data.viz_type;
      const control = {
        ...getControlState(action.controlName, vizType, state, action.value),
      };

      // These errors are based on control config `validators`
      errors = errors.concat(control.validationErrors || []);
      const hasErrors = errors && errors.length > 0;
      return {
        ...state,
        form_data: new_form_data,
        triggerRender: control.renderTrigger && !hasErrors,
        controls: {
          ...state.controls,
          [action.controlName]: {
            ...control,
            validationErrors: errors,
          },
        },
      };
    },
    [actions.SET_EXPLORE_CONTROLS]() {
      return {
        ...state,
        controls: getControlsState(state, action.formData),
      };
    },
    [actions.UPDATE_CHART_TITLE]() {
      const updatedSlice = Object.assign({}, state.slice, {
        slice_name: action.slice_name,
      });
      return {
        ...state,
        slice: updatedSlice,
      };
    },
    [actions.RESET_FIELDS]() {
      return {
        ...state,
        controls: getControlsState(
          state,
          getFormDataFromControls(state.controls),
        ),
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
