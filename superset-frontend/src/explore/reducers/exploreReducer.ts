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
import { ensureIsArray } from '@superset-ui/core';
import { omit, pick } from 'lodash';
import { DYNAMIC_PLUGIN_CONTROLS_READY } from 'src/components/Chart/chartAction';
import { getControlsState } from 'src/explore/store';
import {
  getControlConfig,
  getControlStateFromControlConfig,
  getControlValuesCompatibleWithDatasource,
  StandardizedFormData,
} from 'src/explore/controlUtils';
import * as actions from 'src/explore/actions/exploreActions';
import { HYDRATE_EXPLORE } from '../actions/hydrateExplore';

export default function exploreReducer(state = {}, action: $TSFixMe) {
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
    [actions.START_METADATA_LOADING]() {
      return {
        ...state,
        isDatasourceMetaLoading: true,
      };
    },
    [actions.STOP_METADATA_LOADING]() {
      return {
        ...state,
        isDatasourceMetaLoading: false,
      };
    },
    [actions.SYNC_DATASOURCE_METADATA]() {
      return {
        ...state,
        datasource: action.datasource,
      };
    },
    [actions.UPDATE_FORM_DATA_BY_DATASOURCE]() {
      // @ts-expect-error TS(2339): Property 'form_data' does not exist on type '{}'.
      const newFormData = { ...state.form_data };
      const { prevDatasource, newDatasource } = action;
      // @ts-expect-error TS(2339): Property 'controls' does not exist on type '{}'.
      const controls = { ...state.controls };
      const controlsTransferred: $TSFixMe = [];

      if (
        prevDatasource.id !== newDatasource.id ||
        prevDatasource.type !== newDatasource.type
      ) {
        newFormData.datasource = newDatasource.uid;
      }
      // reset control values for column/metric related controls
      Object.entries(controls).forEach(([controlName, controlState]) => {
        if (
          // for direct column select controls
          // @ts-expect-error TS(2571): Object is of type 'unknown'.
          controlState.valueKey === 'column_name' ||
          // for all other controls
          // @ts-expect-error TS(2571): Object is of type 'unknown'.
          'savedMetrics' in controlState ||
          // @ts-expect-error TS(2571): Object is of type 'unknown'.
          'columns' in controlState ||
          // @ts-expect-error TS(2571): Object is of type 'unknown'.
          ('options' in controlState && !Array.isArray(controlState.options))
        ) {
          newFormData[controlName] = getControlValuesCompatibleWithDatasource(
            newDatasource,
            // @ts-expect-error TS(2345): Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
            controlState,
            // @ts-expect-error TS(2571): Object is of type 'unknown'.
            controlState.value,
          );
          if (
            ensureIsArray(newFormData[controlName]).length > 0 &&
            newFormData[controlName] !== controls[controlName].default
          ) {
            controlsTransferred.push(controlName);
          }
        }
      });

      const newState = {
        ...state,
        controls,
        datasource: action.newDatasource,
      };
      return {
        ...newState,
        form_data: newFormData,
        controls: getControlsState(newState, newFormData),
        controlsTransferred,
      };
    },
    [actions.FETCH_DATASOURCES_STARTED]() {
      return {
        ...state,
        isDatasourcesLoading: true,
      };
    },
    [actions.SET_FIELD_VALUE]() {
      const { controlName, value, validationErrors } = action;
      // @ts-expect-error TS(2339): Property 'form_data' does not exist on type '{}'.
      let new_form_data = { ...state.form_data, [controlName]: value };
      // @ts-expect-error TS(2339): Property 'form_data' does not exist on type '{}'.
      const old_metrics_data = state.form_data.metrics;
      // @ts-expect-error TS(2339): Property 'form_data' does not exist on type '{}'.
      const new_column_config = state.form_data.column_config;

      const vizType = new_form_data.viz_type;

      // if the controlName is metrics, and the metric column name is updated,
      // need to update column config as well to keep the previous config.
      if (controlName === 'metrics' && old_metrics_data && new_column_config) {
        value.forEach((item: $TSFixMe, index: $TSFixMe) => {
          const itemExist = old_metrics_data.some(
            (oldItem: $TSFixMe) => oldItem?.label === item?.label,
          );

          if (
            !itemExist &&
            item?.label !== old_metrics_data[index]?.label &&
            !!new_column_config[old_metrics_data[index]?.label]
          ) {
            new_column_config[item.label] =
              new_column_config[old_metrics_data[index].label];

            delete new_column_config[old_metrics_data[index].label];
          }
        });
        new_form_data.column_config = new_column_config;
      }

      // Use the processed control config (with overrides and everything)
      // if `controlName` does not exist in current controls,
      const controlConfig =
        // @ts-expect-error TS(2339): Property 'controls' does not exist on type '{}'.
        state.controls[action.controlName] ||
        getControlConfig(action.controlName, vizType) ||
        null;

      // will call validators again
      const control = {
        ...getControlStateFromControlConfig(controlConfig, state, action.value),
      };

      const column_config = {
        // @ts-expect-error TS(2339): Property 'controls' does not exist on type '{}'.
        ...state.controls.column_config,
        ...(new_column_config && { value: new_column_config }),
      };

      const newState = {
        ...state,
        controls: {
          // @ts-expect-error TS(2339): Property 'controls' does not exist on type '{}'.
          ...state.controls,
          ...(controlConfig && { [controlName]: control }),
          ...(controlName === 'metrics' && { column_config }),
        },
      };

      const rerenderedControls = {};
      // @ts-expect-error TS(2339): Property 'rerender' does not exist on type '{}'.
      if (Array.isArray(control.rerender)) {
        // @ts-expect-error TS(2339): Property 'rerender' does not exist on type '{}'.
        control.rerender.forEach((controlName: $TSFixMe) => {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
      // @ts-expect-error TS(2339): Property 'validationErrors' does not exist on type... Remove this comment to see the full error message
      const errors = control.validationErrors || [];
      (validationErrors || []).forEach((err: $TSFixMe) => {
        // skip duplicated errors
        if (!errors.includes(err)) {
          errors.push(err);
        }
      });
      const hasErrors = errors && errors.length > 0;

      const isVizSwitch =
        action.controlName === 'viz_type' &&
        // @ts-expect-error TS(2339): Property 'controls' does not exist on type '{}'.
        action.value !== state.controls.viz_type.value;
      // @ts-expect-error TS(2339): Property 'controls' does not exist on type '{}'.
      let currentControlsState = state.controls;
      if (isVizSwitch) {
        // get StandardizedFormData from source form_data
        // @ts-expect-error TS(2339): Property 'form_data' does not exist on type '{}'.
        const sfd = new StandardizedFormData(state.form_data);
        const transformed = sfd.transform(action.value, state);
        new_form_data = transformed.formData;
        currentControlsState = transformed.controlsState;
      }

      // @ts-expect-error TS(2339): Property 'controls' does not exist on type '{}'.
      const dependantControls = Object.entries(state.controls)
        .filter(
          ([, item]) =>
            // @ts-expect-error TS(2571): Object is of type 'unknown'.
            Array.isArray(item?.validationDependancies) &&
            // @ts-expect-error TS(2571): Object is of type 'unknown'.
            item.validationDependancies.includes(controlName),
        )
        .map(([key, item]) => ({
          controlState: item,
          dependantControlName: key,
        }));

      let updatedControlStates = {};
      if (dependantControls.length > 0) {
        const updatedControls = dependantControls.map(
          ({ controlState, dependantControlName }) => {
            // overwrite state form data with current control value as the redux state will not
            // have latest action value
            const overWrittenState = {
              ...state,
              form_data: {
                // @ts-expect-error TS(2339): Property 'form_data' does not exist on type '{}'.
                ...state.form_data,
                [controlName]: action.value,
              },
            };

            return {
              // Re run validation for dependant controls
              controlState: getControlStateFromControlConfig(
                // @ts-expect-error TS(2345): Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
                controlState,
                overWrittenState,
                // @ts-expect-error TS(2571): Object is of type 'unknown'.
                controlState?.value,
              ),
              dependantControlName,
            };
          },
        );

        updatedControlStates = updatedControls.reduce(
          (acc, { controlState, dependantControlName }) => {
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            acc[dependantControlName] = { ...controlState };
            return acc;
          },
          {},
        );
      }

      return {
        ...state,
        form_data: new_form_data,
        // @ts-expect-error TS(2339): Property 'renderTrigger' does not exist on type '{... Remove this comment to see the full error message
        triggerRender: control.renderTrigger && !hasErrors,
        controls: {
          ...currentControlsState,
          ...(controlConfig && {
            [action.controlName]: {
              ...control,
              validationErrors: errors,
            },
          }),
          ...rerenderedControls,
          ...updatedControlStates,
        },
      };
    },
    [actions.SET_EXPLORE_CONTROLS]() {
      return {
        ...state,
        controls: getControlsState(state, action.formData),
      };
    },
    [actions.SET_FORM_DATA]() {
      return {
        ...state,
        form_data: action.formData,
      };
    },
    [actions.UPDATE_CHART_TITLE]() {
      return {
        ...state,
        sliceName: action.sliceName,
      };
    },
    [actions.SET_SAVE_ACTION]() {
      return {
        ...state,
        saveAction: action.saveAction,
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
    [actions.SET_STASH_FORM_DATA]() {
      // @ts-expect-error TS(2339): Property 'form_data' does not exist on type '{}'.
      const { form_data, hiddenFormData } = state;
      const { fieldNames, isHidden } = action;
      if (isHidden) {
        return {
          ...state,
          hiddenFormData: {
            ...hiddenFormData,
            ...pick(form_data, fieldNames),
          },
          form_data: omit(form_data, fieldNames),
        };
      }

      const restoredField = pick(hiddenFormData, fieldNames);
      return Object.keys(restoredField).length === 0
        ? state
        : {
            ...state,
            form_data: {
              ...form_data,
              ...restoredField,
            },
            hiddenFormData: omit(hiddenFormData, fieldNames),
          };
    },
    [actions.SLICE_UPDATED]() {
      return {
        ...state,
        slice: {
          // @ts-expect-error TS(2339): Property 'slice' does not exist on type '{}'.
          ...state.slice,
          ...action.slice,
          owners: action.slice.owners
            ? action.slice.owners.map((owner: $TSFixMe) => owner.value)
            : null,
        },
        // @ts-expect-error TS(2339): Property 'sliceName' does not exist on type '{}'.
        sliceName: action.slice.slice_name ?? state.sliceName,
        metadata: {
          // @ts-expect-error TS(2339): Property 'metadata' does not exist on type '{}'.
          ...state.metadata,
          owners: action.slice.owners
            ? action.slice.owners.map((owner: $TSFixMe) => owner.label)
            : null,
        },
      };
    },
    [actions.SET_FORCE_QUERY]() {
      return {
        ...state,
        force: action.force,
      };
    },
    [HYDRATE_EXPLORE]() {
      return {
        ...action.data.explore,
      };
    },
  };
  if (action.type in actionHandlers) {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return actionHandlers[action.type]();
  }
  return state;
}
