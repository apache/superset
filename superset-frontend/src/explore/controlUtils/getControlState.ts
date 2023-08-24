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
import { ReactNode } from 'react';
import {
  DatasourceType,
  ensureIsArray,
  JsonValue,
  QueryFormData,
} from '@superset-ui/core';
import {
  ControlConfig,
  ControlPanelState,
  ControlState,
  ControlType,
  ControlValueValidator,
  CustomControlItem,
} from '@superset-ui/chart-controls';
import { getSectionsToRender } from './getSectionsToRender';
import { getControlConfig } from './getControlConfig';

type ValidationError = JsonValue;

function execControlValidator<T = ControlType>(
  control: ControlState<T>,
  processedState: ControlState<T>,
) {
  const validators = control.validators as ControlValueValidator[] | undefined;
  const { externalValidationErrors = [] } = control;
  const errors: ValidationError[] = [];
  if (validators && validators.length > 0) {
    validators.forEach(validator => {
      const error = validator.call(control, control.value, processedState);
      if (error) {
        errors.push(error);
      }
    });
  }
  const validationErrors = [...errors, ...externalValidationErrors];
  // always reset validation errors even when there is no validator
  return { ...control, validationErrors };
}

/**
 * Clear control values that are no longer in the `choices` list.
 */
function handleMissingChoice<T = ControlType>(control: ControlState<T>) {
  // If the value is not valid anymore based on choices, clear it
  if (
    control.type === 'SelectControl' &&
    !control.freeForm &&
    control.choices &&
    control.value
  ) {
    const alteredControl = { ...control };
    const choices = control.choices as [JsonValue, ReactNode][];
    const value = ensureIsArray(control.value);
    const choiceValues = choices.map(c => c[0]);
    if (control.multi && value.length > 0) {
      alteredControl.value = value.filter(el => choiceValues.includes(el));
      return alteredControl;
    }
    if (!control.multi && !choiceValues.includes(value[0])) {
      alteredControl.value = null;
      return alteredControl;
    }
  }
  return control;
}

export function applyMapStateToPropsToControl<T = ControlType>(
  controlState: ControlState<T>,
  controlPanelState: Partial<ControlPanelState> | null,
) {
  const { mapStateToProps } = controlState;
  let state = { ...controlState };
  let { value } = state; // value is current user-input value
  if (mapStateToProps && controlPanelState) {
    state = {
      ...controlState,
      ...mapStateToProps.call(controlState, controlPanelState, controlState),
    };
    // `mapStateToProps` may also provide a value
    value = value || state.value;
  }

  // InitialValue is used for setting value for the control,
  // this value is not recalculated. The default value will override it.
  if (typeof state.initialValue === 'function') {
    state.initialValue = state.initialValue(state, controlPanelState);
    // if default is still a function, discard
    if (typeof state.initialValue === 'function') {
      delete state.initialValue;
    }
  }
  if (state.initialValue) {
    value = state.initialValue;
    delete state.initialValue;
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
  return execControlValidator(handleMissingChoice(state), state);
}

export function getControlStateFromControlConfig<T = ControlType>(
  controlConfig: ControlConfig<T> | null,
  controlPanelState: Partial<ControlPanelState> | null,
  value?: JsonValue,
) {
  // skip invalid config values
  if (!controlConfig) {
    return null;
  }
  const controlState = { ...controlConfig, value } as ControlState<T>;
  // only apply mapStateToProps when control states have been initialized
  // or when explicitly didn't provide control panel state (mostly for testing)
  if (controlPanelState?.controls || controlPanelState === null) {
    return applyMapStateToPropsToControl(controlState, controlPanelState);
  }
  return controlState;
}

export function getControlState(
  controlKey: string,
  vizType: string,
  state: Partial<ControlPanelState>,
  value?: JsonValue,
) {
  return getControlStateFromControlConfig(
    getControlConfig(controlKey, vizType),
    state,
    value,
  );
}

export function getAllControlsState(
  vizType: string,
  datasourceType: DatasourceType,
  state: ControlPanelState | null,
  formData: QueryFormData,
) {
  const controlsState = {};
  getSectionsToRender(vizType, datasourceType).forEach(section =>
    section.controlSetRows.forEach(fieldsetRow =>
      fieldsetRow.forEach((field: CustomControlItem) => {
        if (field?.config && field.name) {
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
