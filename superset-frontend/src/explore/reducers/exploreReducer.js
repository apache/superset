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
import { DYNAMIC_PLUGIN_CONTROLS_READY } from 'src/chart/chartAction';
import { getControlsState } from '../store';
import {
  getControlConfig,
  getFormDataFromControls,
  getControlStateFromControlConfig,
} from '../controlUtils';
import * as actions from '../actions/exploreActions';

export default function exploreReducer(state = {}, action) {
  const actionHandlers = {
    [DYNAMIC_PLUGIN_CONTROLS_READY]() {
      return {
        ...state,
        controls: action.controlsState,
      };
    },
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
      const newFormData = { ...state.form_data };
      if (action.datasource.type !== state.datasource.type) {
        if (action.datasource.type === 'table') {
          newFormData.granularity_sqla = action.datasource.granularity_sqla;
          newFormData.time_grain_sqla = action.datasource.time_grain_sqla;
          delete newFormData.druid_time_origin;
          delete newFormData.granularity;
        } else {
          newFormData.druid_time_origin = action.datasource.druid_time_origin;
          newFormData.granularity = action.datasource.granularity;
          delete newFormData.granularity_sqla;
          delete newFormData.time_grain_sqla;
        }
      }
      const newState = {
        ...state,
        datasource: action.datasource,
        datasource_id: action.datasource.id,
        datasource_type: action.datasource.type,
      };
      return {
        ...newState,
        form_data: newFormData,
        controls: getControlsState(newState, newFormData),
      };
    },
    [actions.FETCH_DATASOURCES_STARTED]() {
      return {
        ...state,
        isDatasourcesLoading: true,
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
      const new_form_data = state.form_data;
      const { controlName, value, validationErrors } = action;
      new_form_data[controlName] = value;

      const vizType = new_form_data.viz_type;

      // Use the processed control config (with overrides and everything)
      // if `controlName` does not existing in current controls,
      const controlConfig =
        state.controls[action.controlName] ||
        getControlConfig(action.controlName, vizType) ||
        {};

      // will call validators again
      const control = {
        ...getControlStateFromControlConfig(controlConfig, state, action.value),
      };

      // combine newly detected errors with errors from `onChange` event of
      // each control component (passed via reducer action).
      const errors = control.validationErrors || [];
      (validationErrors || []).forEach(err => {
        // skip duplicated errors
        if (!errors.includes(err)) {
          errors.push(err);
        }
      });
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
      return {
        ...state,
        sliceName: action.sliceName,
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
    [actions.SLICE_UPDATED]() {
      return {
        ...state,
        slice: {
          ...state.slice,
          ...action.slice,
        },
      };
    },
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
