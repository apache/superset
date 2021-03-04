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
import { getSectionsToRender } from './getSectionsToRender';
import { getControlConfig } from './getControlConfig';

export * from './getFormDataFromControls';
export * from './getControlConfig';
export * from './getSectionsToRender';

export function validateControl(control, processedState) {
  const { validators } = control;
  const validationErrors = [];
  if (validators && validators.length > 0) {
    validators.forEach(f => {
      const v = f.call(control, control.value, processedState);
      if (v) {
        validationErrors.push(v);
      }
    });
  }
  // always reset validation errors even when there is no validator
  return { ...control, validationErrors };
}

function handleMissingChoice(control) {
  // If the value is not valid anymore based on choices, clear it
  const { value } = control;
  if (
    control.type === 'SelectControl' &&
    !control.freeForm &&
    control.choices &&
    value
  ) {
    const alteredControl = { ...control };
    const choiceValues = control.choices.map(c => c[0]);
    if (control.multi && value.length > 0) {
      alteredControl.value = value.filter(el => choiceValues.indexOf(el) > -1);
      return alteredControl;
    }
    if (!control.multi && choiceValues.indexOf(value) < 0) {
      alteredControl.value = null;
      return alteredControl;
    }
  }
  return control;
}

export function applyMapStateToPropsToControl(controlState, controlPanelState) {
  const { mapStateToProps } = controlState;
  let state = { ...controlState };
  let { value } = state; // value is current user-input value
  if (mapStateToProps && controlPanelState) {
    state = {
      ...controlState,
      ...mapStateToProps(controlPanelState, controlState),
    };
    // `mapStateToProps` may also provide a value
    value = value || state.value;
  }
  // If default is a function, evaluate it
  if (typeof state.default === 'function') {
    state.default = state.default(state, controlPanelState);
    // if default is still a function, discard
    if (typeof state.default === 'function') {
      delete state.default;
    }
  }
  // If no current value, set it as default
  if (state.default && value === undefined) {
    value = state.default;
  }
  // If a choice control went from multi=false to true, wrap value in array
  if (value && state.multi && !Array.isArray(value)) {
    value = [value];
  }
  state.value = value;
  return validateControl(handleMissingChoice(state), state);
}

export function getControlStateFromControlConfig(
  controlConfig,
  controlPanelState,
  value,
) {
  // skip invalid config values
  if (!controlConfig) {
    return null;
  }
  const controlState = { ...controlConfig, value };
  // only apply mapStateToProps when control states have been initialized
  // or when explicitly didn't provide control panel state (mostly for testing)
  if (
    (controlPanelState && controlPanelState.controls) ||
    controlPanelState === null
  ) {
    return applyMapStateToPropsToControl(controlState, controlPanelState);
  }
  return controlState;
}

export function getControlState(controlKey, vizType, state, value) {
  return getControlStateFromControlConfig(
    getControlConfig(controlKey, vizType),
    state,
    value,
  );
}

export function getAllControlsState(vizType, datasourceType, state, formData) {
  const controlsState = {};
  getSectionsToRender(vizType, datasourceType).forEach(section =>
    section.controlSetRows.forEach(fieldsetRow =>
      fieldsetRow.forEach(field => {
        if (field && field.config && field.name) {
          const { config, name } = field;
          controlsState[name] = getControlStateFromControlConfig(
            config,
            state,
            formData[name],
          );
        }
      }),
    ),
  );
  return controlsState;
}
