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
  DatasourceType,
  getChartControlPanelRegistry,
  VizType,
} from '@superset-ui/core';
import type { QueryFormData } from '@superset-ui/core';
import { getAllControlsState, getFormDataFromControls } from './controlUtils';
import { controls } from './controls';

interface ExploreState {
  common?: {
    conf: {
      DEFAULT_VIZ_TYPE?: string;
    };
  };
  datasource: {
    type: string;
  };
}

type FormData = QueryFormData & {
  y_axis_zero?: boolean;
  y_axis_bounds?: [number | null, number | null];
  datasource?: string;
  matrixify_enable?: boolean;
  matrixify_mode_rows?: string;
  matrixify_mode_columns?: string;
  // Pre-revamp per-axis enable flags (removed in #38519, may still exist in
  // persisted form_data for charts that actually used matrixify)
  matrixify_enable_vertical_layout?: boolean;
  matrixify_enable_horizontal_layout?: boolean;
};

export function handleDeprecatedControls(formData: FormData): void {
  // Reaffectation / handling of deprecated controls
  /* eslint-disable no-param-reassign */

  // y_axis_zero was a boolean forcing 0 to be part of the Y Axis
  if (formData.y_axis_zero) {
    formData.y_axis_bounds = [0, null];
  }

  // #38519: migrate pre-revamp matrixify controls to the new single-toggle
  // system. Before the revamp, per-axis enable flags
  // (matrixify_enable_vertical_layout / matrixify_enable_horizontal_layout)
  // gated visibility, and matrixify_mode_rows/columns defaulted to
  // non-disabled values ('dimensions'/'metrics'). The revamp replaced those
  // with a single matrixify_enable toggle and mode default 'disabled'.
  //
  // Charts that actually used matrixify pre-revamp have the old per-axis
  // flags set to true — we must preserve their modes and set
  // matrixify_enable: true. Charts that never used matrixify (or predate it)
  // need stale mode defaults reset to 'disabled' because 4 downstream UI
  // consumers (ExploreChartPanel, ChartContextMenu, DrillBySubmenu,
  // ChartRenderer) infer "matrixify is active" from mode values alone.
  if (!('matrixify_enable' in formData)) {
    const hadVerticalLayout =
      formData.matrixify_enable_vertical_layout === true;
    const hadHorizontalLayout =
      formData.matrixify_enable_horizontal_layout === true;

    if (hadVerticalLayout || hadHorizontalLayout) {
      // Pre-revamp chart that genuinely used matrixify — migrate to new flag
      formData.matrixify_enable = true;
      if (!hadVerticalLayout) formData.matrixify_mode_rows = 'disabled';
      if (!hadHorizontalLayout) formData.matrixify_mode_columns = 'disabled';
    } else {
      // Never used matrixify — reset stale defaults
      formData.matrixify_mode_rows = 'disabled';
      formData.matrixify_mode_columns = 'disabled';
    }
  }
}

export function getControlsState(
  state: ExploreState,
  inputFormData: FormData,
): Record<string, unknown> {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsState = getAllControlsState(
    vizType,
    state.datasource.type as DatasourceType,
    state as any,
    formData,
  );

  const controlPanelConfig = getChartControlPanelRegistry().get(vizType) || {};
  if (controlPanelConfig.onInit) {
    return controlPanelConfig.onInit(controlsState);
  }

  return controlsState;
}

export function applyDefaultFormData(
  inputFormData: FormData,
): Record<string, unknown> {
  // Normalize deprecated controls before building control state — ensures
  // stale matrixify modes are cleaned on the dashboard hydration path too,
  // not just the explore path (getControlsState).
  const cleanedFormData = { ...inputFormData };
  handleDeprecatedControls(cleanedFormData);

  const datasourceType = cleanedFormData.datasource?.split('__')[1] ?? '';
  const vizType = cleanedFormData.viz_type;
  const controlsState = getAllControlsState(
    vizType,
    datasourceType as DatasourceType,
    null,
    cleanedFormData,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlFormData = getFormDataFromControls(controlsState as any);

  const formData: Record<string, unknown> = {};
  Object.keys(controlsState)
    .concat(Object.keys(cleanedFormData))
    .forEach(controlName => {
      if (cleanedFormData[controlName as keyof FormData] === undefined) {
        formData[controlName] = controlFormData[controlName];
      } else {
        formData[controlName] = cleanedFormData[controlName as keyof FormData];
      }
    });

  return formData;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const defaultControls: Record<string, any> = { ...controls };
Object.keys(controls).forEach(f => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultControls[f].value = (controls as any)[f].default;
});

const defaultState = {
  controls: defaultControls,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form_data: getFormDataFromControls(defaultControls as any),
};

export { defaultControls, defaultState };
