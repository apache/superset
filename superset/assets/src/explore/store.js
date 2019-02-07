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
import React from 'react';
import { flatMap, flow } from 'lodash/fp';
import controls from './controls';
import controlPanelConfigs, { sectionsToRender } from './controlPanels';

export function getFormDataFromControls(controlsState) {
  const formData = {};
  Object.keys(controlsState).forEach((controlName) => {
    formData[controlName] = controlsState[controlName].value;
  });
  return formData;
}

export function validateControl(control) {
  const validators = control.validators;
  const validationErrors = [];
  if (validators && validators.length > 0) {
    validators.forEach((f) => {
      const v = f(control.value);
      if (v) {
        validationErrors.push(v);
      }
    });
  }
  if (validationErrors.length > 0) {
    return { ...control, validationErrors };
  }
  return control;
}

function getControlItems(vizType, datasourceType) {
  return flow(
    flatMap(section => section.controlSetRows),
    flatMap(row => row.filter(c => c && !React.isValidElement(c))
      .map(c => c.name && c.config
        ? c
        : { name: c, config: controls[c] })),
  )(sectionsToRender(vizType, datasourceType));
}

function handleDeprecatedControls(formData) {
  // Reacffectation / handling of deprecated controls
  /* eslint-disable no-param-reassign */

  // y_axis_zero was a boolean forcing 0 to be part of the Y Axis
  if (formData.y_axis_zero) {
    formData.y_axis_bounds = [0, null];
  }
}

export function getControlsState(state, form_data) {
  /*
  * Gets a new controls object to put in the state. The controls object
  * is similar to the configuration control with only the controls
  * related to the current viz_type, materializes mapStateToProps functions,
  * adds value keys coming from form_data passed here. This can't be an action creator
  * just yet because it's used in both the explore and dashboard views.
  * */

  // Getting a list of active control names for the current viz
  const formData = Object.assign({}, form_data);
  const vizType = formData.viz_type || 'table';

  handleDeprecatedControls(formData);

  const controlItems = getControlItems(vizType, state.datasource.type);

  const viz = controlPanelConfigs[vizType] || {};
  const controlOverrides = viz.controlOverrides || {};
  const controlsState = {};
  controlItems.forEach(({ name, config }) => {
    const control = { ...config, ...controlOverrides[name] };
    if (control.mapStateToProps) {
      Object.assign(control, control.mapStateToProps(state, control));
      delete control.mapStateToProps;
    }

    formData[name] = (control.multi && formData[name] && !Array.isArray(formData[name]))
      ? [formData[name]]
      : formData[name];

    // If the value is not valid anymore based on choices, clear it
    if (
      control.type === 'SelectControl' &&
      !control.freeForm &&
      control.choices &&
      name !== 'datasource' &&
      formData[name]
    ) {
      const choiceValues = control.choices.map(c => c[0]);
      if (control.multi && formData[name].length > 0) {
        formData[name] = formData[name].filter(el => choiceValues.indexOf(el) > -1);
      } else if (!control.multi && choiceValues.indexOf(formData[name]) < 0) {
        delete formData[name];
      }
    }

    if (typeof control.default === 'function') {
      control.default = control.default(control);
    }
    control.validationErrors = [];
    control.value = control.default;
    // formData[name]'s type should match control value type
    if (formData[name] !== undefined &&
      (Array.isArray(formData[name]) && control.multi || !control.multi)
    ) {
      control.value = formData[name];
    }
    controlsState[name] = validateControl(control);
  });
  if (viz.onInit) {
    return viz.onInit(controlsState);
  }
  return controlsState;
}

export function applyDefaultFormData(form_data) {
  const datasourceType = form_data.datasource.split('__')[1];
  const vizType = form_data.viz_type || 'table';
  const viz = controlPanelConfigs[vizType] || {};
  const controlItems = getControlItems(vizType, datasourceType);
  const controlOverrides = viz.controlOverrides || {};
  const formData = {};
  controlItems.forEach(({ name, config }) => {
    const control = { ...config, ...controlOverrides[name] };
    if (form_data[name] === undefined) {
      if (typeof control.default === 'function') {
        formData[name] = control.default(config);
      } else {
        formData[name] = control.default;
      }
    } else {
      formData[name] = form_data[name];
    }
  });
  return formData;
}

export const autoQueryControls = [
  'datasource',
  'viz_type',
];

const defaultControls = Object.assign({}, controls);
Object.keys(controls).forEach((f) => {
  defaultControls[f].value = controls[f].default;
});

const defaultState = {
  controls: defaultControls,
  form_data: getFormDataFromControls(defaultControls),
};

export { defaultControls, defaultState };
