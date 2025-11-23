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
import React, { ReactNode } from 'react';
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
import { getControlNameFromComponent } from './getControlNameFromComponent';
import { ExtendedControlComponentProps } from '@superset-ui/chart-controls';

type ValidationError = JsonValue;

/**
 * Type for React components that can be used as controls.
 * These components may have optional static properties for control configuration.
 */
type ControlComponent = React.ComponentType<ExtendedControlComponentProps> & {
  controlConfig?: ControlConfig;
  defaultProps?: { name?: string };
};

/**
 * Type guard to check if a component has controlConfig property.
 */
function hasControlConfig(
  component: React.ComponentType<ExtendedControlComponentProps>,
): component is ControlComponent {
  return (
    typeof component === 'function' &&
    'controlConfig' in component &&
    (component as ControlComponent).controlConfig !== undefined
  );
}

/**
 * Safely extracts controlConfig from a component if it exists.
 */
export function getControlConfigFromComponent(
  component: React.ComponentType<ExtendedControlComponentProps>,
): ControlConfig | undefined {
  if (hasControlConfig(component)) {
    return component.controlConfig;
  }
  return undefined;
}

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
  const controlConfig = getControlConfig(controlKey, vizType);

  // If getControlConfig returns a React component (function component),
  // wrap it in a config object
  if (typeof controlConfig === 'function') {
    const Component =
      controlConfig as React.ComponentType<ExtendedControlComponentProps>;
    const componentConfig = getControlConfigFromComponent(Component);
    // Use type assertion since ControlConfig has complex conditional types
    // that don't work well with typeof Component
    const wrappedConfig = {
      type: Component,
      ...componentConfig,
    } as ControlConfig;
    return getControlStateFromControlConfig(wrappedConfig, state, value);
  }

  return getControlStateFromControlConfig(controlConfig, state, value);
}

export function getAllControlsState(
  vizType: string,
  datasourceType: DatasourceType,
  state: ControlPanelState | null,
  formData: QueryFormData,
) {
  // ControlState<any> is necessary here because we're storing heterogeneous control states
  // with potentially different value types (string, number, object, etc.)
  const controlsState: Record<string, ControlState | null> = {};
  getSectionsToRender(vizType, datasourceType).forEach(section => {
    if (!section || !section.controlSetRows) return;
    section.controlSetRows.forEach(fieldsetRow =>
      fieldsetRow.forEach((field: CustomControlItem) => {
        if (field?.config && field.name) {
          // Legacy config object format
          const { config, name } = field;
          controlsState[name] = getControlStateFromControlConfig(
            config,
            state,
            formData[name],
          );
        } else if (typeof field === 'function') {
          // Handle React component references (function components)
          const Component =
            field as React.ComponentType<ExtendedControlComponentProps>;
          const controlName = getControlNameFromComponent(Component);

          if (controlName) {
            // Create minimal config for React component controls
            const componentConfig = getControlConfigFromComponent(Component);
            // Use type assertion since ControlConfig has complex conditional types
            // that don't work well with typeof Component
            const config = {
              type: Component,
              ...componentConfig,
            } as ControlConfig;
            controlsState[controlName] = getControlStateFromControlConfig(
              config,
              state,
              formData[controlName],
            );
          }
        } else if (
          // Handle React elements (component-based controls)
          typeof field === 'object' &&
          field !== null &&
          'type' in field
        ) {
          // Type assertion through unknown is necessary because CustomControlItem
          // and ReactElement don't have sufficient type overlap
          const element = field as unknown as React.ReactElement;
          const isComponent = typeof element.type === 'function';
          const isMarkerElement =
            typeof element.type === 'string' && element.props?.type;

          if (isMarkerElement) {
            // Marker element (div with type prop) - extract config from props
            const { name, type, ...configProps } = element.props;
            if (
              name &&
              type &&
              typeof type === 'string' &&
              type.endsWith('Control')
            ) {
              const config = {
                type,
                ...configProps,
              };
              controlsState[name] = getControlStateFromControlConfig(
                config,
                state,
                formData[name],
              );
            }
          } else if (isComponent) {
            // React component - extract control name from component
            // Type assertion needed because element.type could be string or ComponentType
            const ComponentType =
              element.type as React.ComponentType<ExtendedControlComponentProps>;
            const controlName = getControlNameFromComponent(
              ComponentType,
              element.props,
            );

            if (controlName) {
              // For React components, we need to infer the control type from the component
              // Since these are actual components, we'll use a generic config
              // The component will handle its own rendering
              const componentConfig =
                getControlConfigFromComponent(ComponentType);
              // Use type assertion since ControlConfig has complex conditional types
              // that don't work well with typeof ComponentType
              const config = {
                type: ComponentType, // Component type - component renders itself
                // Extract config from component static properties if available
                ...componentConfig,
              } as ControlConfig;
              controlsState[controlName] = getControlStateFromControlConfig(
                config,
                state,
                formData[controlName],
              );
            }
          }
        }
      }),
    );
  });
  return controlsState;
}
