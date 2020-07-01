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
import memoizeOne from 'memoize-one';
import { getChartControlPanelRegistry } from '@superset-ui/chart';
import { expandControlConfig } from '@superset-ui/chart-controls';
import { controls as SHARED_CONTROLS } from './controls';
import * as SECTIONS from './controlPanels/sections';

export function getFormDataFromControls(controlsState) {
  const formData = { queryFields: {} };
  Object.keys(controlsState).forEach(controlName => {
    const control = controlsState[controlName];
    formData[controlName] = control.value;
    if (control.hasOwnProperty('queryField')) {
      formData.queryFields[controlName] = control.queryField;
    }
  });
  return formData;
}

export function validateControl(control, processedState) {
  const validators = control.validators;
  if (validators && validators.length > 0) {
    const validatedControl = { ...control };
    const validationErrors = [];
    validators.forEach(f => {
      const v = f.call(control, control.value, processedState);
      if (v) {
        validationErrors.push(v);
      }
    });
    delete validatedControl.validators;
    return { ...validatedControl, validationErrors };
  }
  return control;
}

/**
 * Find control item from control panel config.
 */
function findControlItem(controlPanelSections, controlKey) {
  for (const section of controlPanelSections) {
    for (const controlArr of section.controlSetRows) {
      for (const control of controlArr) {
        if (controlKey === control) return control;
        if (
          control !== null &&
          typeof control === 'object' &&
          control.name === controlKey
        ) {
          return control;
        }
      }
    }
  }
  return null;
}

export const getControlConfig = memoizeOne(function getControlConfig(
  controlKey,
  vizType,
) {
  const controlPanelConfig = getChartControlPanelRegistry().get(vizType) || {};
  const {
    controlOverrides = {},
    controlPanelSections = [],
  } = controlPanelConfig;

  const control = expandControlConfig(
    findControlItem(controlPanelSections, controlKey),
    controlOverrides,
  );
  return control?.config || control;
});

export function applyMapStateToPropsToControl(control, state) {
  if (control.mapStateToProps) {
    const appliedControl = { ...control };
    if (state) {
      Object.assign(appliedControl, control.mapStateToProps(state, control));
    }
    delete appliedControl.mapStateToProps;
    return appliedControl;
  }
  return control;
}

function handleMissingChoice(control) {
  // If the value is not valid anymore based on choices, clear it
  const value = control.value;
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
    } else if (!control.multi && choiceValues.indexOf(value) < 0) {
      alteredControl.value = null;
      return alteredControl;
    }
  }
  return control;
}

export function getControlStateFromControlConfig(controlConfig, state, value) {
  // skip invalid config values
  if (!controlConfig) {
    return null;
  }
  const controlState = applyMapStateToPropsToControl(
    { ...controlConfig },
    state,
  );

  // If default is a function, evaluate it
  if (typeof controlState.default === 'function') {
    controlState.default = controlState.default(controlState);
  }

  // If a choice control went from multi=false to true, wrap value in array
  const controlValue =
    controlConfig.multi && value && !Array.isArray(value) ? [value] : value;
  controlState.value =
    typeof controlValue === 'undefined' ? controlState.default : controlValue;

  return validateControl(handleMissingChoice(controlState), controlState);
}

export function getControlState(controlKey, vizType, state, value) {
  return getControlStateFromControlConfig(
    getControlConfig(controlKey, vizType),
    state,
    value,
  );
}

/**
 * Get the clean and processed control panel sections
 */
export const sectionsToRender = memoizeOne(function sectionsToRender(
  vizType,
  datasourceType,
) {
  const controlPanelConfig = getChartControlPanelRegistry().get(vizType) || {};
  const {
    sectionOverrides = {},
    controlOverrides,
    controlPanelSections = [],
  } = controlPanelConfig;

  // default control panel sections
  const sections = { ...SECTIONS };

  // apply section overrides
  Object.entries(sectionOverrides).forEach(([section, overrides]) => {
    if (typeof overrides === 'object' && overrides.constructor === Object) {
      sections[section] = {
        ...sections[section],
        ...overrides,
      };
    } else {
      sections[section] = overrides;
    }
  });

  const { datasourceAndVizType, sqlaTimeSeries, druidTimeSeries } = sections;
  const timeSection =
    datasourceType === 'table' ? sqlaTimeSeries : druidTimeSeries;

  return []
    .concat(datasourceAndVizType, timeSection, controlPanelSections)
    .filter(section => !!section)
    .map(section => {
      const { controlSetRows } = section;
      return {
        ...section,
        controlSetRows:
          controlSetRows?.map(row =>
            row.map(item => expandControlConfig(item, controlOverrides)),
          ) || [],
      };
    });
});

export function getAllControlsState(vizType, datasourceType, state, formData) {
  const controlsState = {};
  sectionsToRender(vizType, datasourceType).forEach(section =>
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
