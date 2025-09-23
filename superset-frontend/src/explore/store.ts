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
import {
  getChartControlPanelRegistry,
  VizType,
  QueryFormData,
  DatasourceType,
} from '@superset-ui/core';
import {
  ControlStateMapping,
  ControlPanelState,
} from '@superset-ui/chart-controls';
import { getAllControlsState, getFormDataFromControls } from './controlUtils';
import { controls } from './controls';
import { ExplorePageState } from './types';

function handleDeprecatedControls(formData: QueryFormData): void {
  // Reaffectation / handling of deprecated controls
  /* eslint-disable no-param-reassign */

  // y_axis_zero was a boolean forcing 0 to be part of the Y Axis
  if (formData.y_axis_zero) {
    formData.y_axis_bounds = [0, null];
  }
}

export function getControlsState(
  state: Partial<ExplorePageState>,
  inputFormData: QueryFormData,
): ControlStateMapping {
  /*
   * Gets a new controls object to put in the state. The controls object
   * is similar to the configuration control with only the controls
   * related to the current viz_type, materializes mapStateToProps functions,
   * adds value keys coming from inputFormData passed here. This can't be an action creator
   * just yet because it's used in both the explore and dashboard views.
   * */
  // Getting a list of active control names for the current viz
  const formData = { ...inputFormData };
  const vizType =
    formData.viz_type || state.common?.conf.DEFAULT_VIZ_TYPE || VizType.Table;

  handleDeprecatedControls(formData);

  // Create a proper ControlPanelState from the partial state
  const controlPanelState: ControlPanelState = {
    slice: state.explore?.slice || { slice_id: -1 },
    form_data: formData,
    datasource: state.explore?.datasource || null,
    controls: state.explore?.controls || {},
    common: state.common || {},
    metadata: null,
  };

  const controlsState = getAllControlsState(
    vizType,
    state.explore?.datasource?.type as DatasourceType,
    controlPanelState,
    formData,
  );

  // Filter out null values to match ControlStateMapping type
  const filteredControlsState: ControlStateMapping = {};
  Object.keys(controlsState).forEach(key => {
    const control = controlsState[key];
    if (control !== null) {
      filteredControlsState[key] = control;
    }
  });

  const controlPanelConfig = getChartControlPanelRegistry().get(vizType) || {};
  if (controlPanelConfig.onInit) {
    return controlPanelConfig.onInit(filteredControlsState);
  }

  return filteredControlsState;
}

export function applyDefaultFormData(
  inputFormData: QueryFormData,
): QueryFormData {
  const datasourceType = inputFormData.datasource.split(
    '__',
  )[1] as DatasourceType;
  const vizType = inputFormData.viz_type;
  const rawControlsState = getAllControlsState(
    vizType,
    datasourceType,
    null,
    inputFormData,
  );

  // Filter out null values to match ControlStateMapping type
  const controlsState: ControlStateMapping = {};
  Object.keys(rawControlsState).forEach(key => {
    const control = rawControlsState[key];
    if (control !== null) {
      controlsState[key] = control;
    }
  });

  const controlFormData = getFormDataFromControls(controlsState);

  const formData: QueryFormData = {
    datasource: inputFormData.datasource,
    viz_type: inputFormData.viz_type,
  };
  Object.keys(controlsState)
    .concat(Object.keys(inputFormData))
    .forEach(controlName => {
      if (inputFormData[controlName] === undefined) {
        formData[controlName] = controlFormData[controlName];
      } else {
        formData[controlName] = inputFormData[controlName];
      }
    });

  return formData;
}

const defaultControls: ControlStateMapping = {
  ...controls,
} as ControlStateMapping;
Object.keys(controls).forEach(f => {
  if (defaultControls[f]) {
    defaultControls[f] = {
      ...defaultControls[f],
      value: (controls as Record<string, any>)[f].default,
    };
  }
});

const defaultState: {
  controls: ControlStateMapping;
  form_data: QueryFormData;
} = {
  controls: defaultControls,
  form_data: getFormDataFromControls(defaultControls),
};

export { defaultControls, defaultState };
