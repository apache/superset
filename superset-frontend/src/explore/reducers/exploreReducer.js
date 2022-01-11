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
import { DEFAULT_TIME_RANGE } from 'src/explore/constants';
import { getControlsState } from 'src/explore/store';
import {
  getControlConfig,
  getFormDataFromControls,
  getControlStateFromControlConfig,
} from 'src/explore/controlUtils';
import * as actions from 'src/explore/actions/exploreActions';

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

      const controls = { ...state.controls };
      if (
        action.datasource.id !== state.datasource.id ||
        action.datasource.type !== state.datasource.type
      ) {
        // reset time range filter to default
        newFormData.time_range = DEFAULT_TIME_RANGE;

        // reset control values for column/metric related controls
        Object.entries(controls).forEach(([controlName, controlState]) => {
          if (
            // for direct column select controls
            controlState.valueKey === 'column_name' ||
            // for all other controls
            'columns' in controlState
          ) {
            // if a control use datasource columns, reset its value to `undefined`,
            // then `getControlsState` will pick up the default.
            // TODO: filter out only invalid columns and keep others
            controls[controlName] = {
              ...controlState,
              value: undefined,
            };
            newFormData[controlName] = undefined;
          }
        });
      }

      const newState = {
        ...state,
        controls,
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

      const newState = {
        ...state,
        controls: { ...state.controls, [action.controlName]: control },
      };

      const rerenderedControls = {};
      if (Array.isArray(control.rerender)) {
        control.rerender.forEach(controlName => {
          rerenderedControls[controlName] = {
            ...getControlStateFromControlConfig(
              newState.controls[controlName],
              newState,
              newState.controls[controlName].value,
            ),
          };
        });
      }

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

      const currentControlsState =
        action.controlName === 'viz_type' &&
        action.value !== state.controls.viz_type.value
          ? // rebuild the full control state if switching viz type
            getControlsState(
              state,
              getFormDataFromControls({
                ...state.controls,
                viz_type: control,
              }),
            )
          : state.controls;

      return {
        ...state,
        form_data: new_form_data,
        triggerRender: control.renderTrigger && !hasErrors,
        controls: {
          ...currentControlsState,
          [action.controlName]: {
            ...control,
            validationErrors: errors,
          },
          ...rerenderedControls,
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
          owners: action.slice.owners ?? null,
        },
        sliceName: action.slice.slice_name ?? state.sliceName,
      };
    },
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
