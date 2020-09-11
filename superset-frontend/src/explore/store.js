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
import { getChartControlPanelRegistry } from '@superset-ui/core';
import { getAllControlsState, getFormDataFromControls } from './controlUtils';
import controls from './controls';

function handleDeprecatedControls(formData) {
  // Reacffectation / handling of deprecated controls
  /* eslint-disable no-param-reassign */

  // y_axis_zero was a boolean forcing 0 to be part of the Y Axis
  if (formData.y_axis_zero) {
    formData.y_axis_bounds = [0, null];
  }
}

export function getControlsState(state, inputFormData) {
  /*
   * Gets a new controls object to put in the state. The controls object
   * is similar to the configuration control with only the controls
   * related to the current viz_type, materializes mapStateToProps functions,
   * adds value keys coming from inputFormData passed here. This can't be an action creator
   * just yet because it's used in both the explore and dashboard views.
   * */
  // Getting a list of active control names for the current viz
  const formData = { ...inputFormData };
  const vizType = formData.viz_type || 'table';

  handleDeprecatedControls(formData);

  const controlsState = getAllControlsState(
    vizType,
    state.datasource.type,
    state,
    formData,
  );

  const controlPanelConfig = getChartControlPanelRegistry().get(vizType) || {};
  if (controlPanelConfig.onInit) {
    return controlPanelConfig.onInit(controlsState);
  }

  return controlsState;
}

export function applyDefaultFormData(inputFormData) {
  const datasourceType = inputFormData.datasource.split('__')[1];
  const vizType = inputFormData.viz_type;
  const controlsState = getAllControlsState(vizType, datasourceType, null, {
    ...inputFormData,
  });
  const controlFormData = getFormDataFromControls(controlsState);

  const formData = {};
  Object.keys(controlsState).forEach(controlName => {
    if (inputFormData[controlName] === undefined) {
      formData[controlName] = controlFormData[controlName];
    } else {
      formData[controlName] = inputFormData[controlName];
    }
  });

  // always use dynamically generated queryFields
  formData.queryFields = controlFormData.queryFields;
  return formData;
}

const defaultControls = { ...controls };
Object.keys(controls).forEach(f => {
  defaultControls[f].value = controls[f].default;
});

const defaultState = {
  controls: defaultControls,
  form_data: getFormDataFromControls(defaultControls),
};

export { defaultControls, defaultState };
