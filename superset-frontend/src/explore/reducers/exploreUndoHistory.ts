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
import type { QueryFormData } from '@superset-ui/core';
import type { ControlStateMapping } from '@superset-ui/chart-controls';
import { mapValues, pick } from 'lodash-es';
import { getControlsState } from 'src/explore/store';
import { getFormDataFromControls } from 'src/explore/controlUtils';
import type { ExploreState } from './exploreReducer';

export const MAX_HISTORY = 50;

/**
 * Fields carried on `state.form_data` that no control backs, so they never
 * round-trip through `getFormDataFromControls`. A field added to
 * `state.form_data` outside of a control must be added here, or undo and redo
 * silently drop it.
 */
export const NON_CONTROL_FORM_DATA_FIELDS = [
  'dashboardId',
  'layer_filter_scope',
  'filter_data_mapping',
  'own_color_scheme',
  'dashboard_color_scheme',
  'standardizedFormData',
] as const;

export interface ExploreHistoryFrame {
  formData: QueryFormData;
  hiddenFormData: Partial<QueryFormData>;
}

export interface ExploreUndoHistory {
  past: ExploreHistoryFrame[];
  future: ExploreHistoryFrame[];
  /**
   * Monotonic counter bumped by every undo and redo. Clearing the stacks does
   * not reset it: a clear is not a restore, so it must not read as a restore
   * to anything watching the counter.
   */
  restoreEpoch: number;
}

export function pickNonControlFormData(
  formData: Partial<QueryFormData> | undefined,
): Partial<QueryFormData> {
  return pick(formData, NON_CONTROL_FORM_DATA_FIELDS) as Partial<QueryFormData>;
}

/**
 * Canonical snapshot of the chart configuration, used identically for the
 * push-guard comparison and for the frames pushed to `past` and `future`.
 */
export function buildHistoryFrame(state: ExploreState): ExploreHistoryFrame {
  const formData = {
    ...pickNonControlFormData(state.form_data),
    ...getFormDataFromControls(state.controls),
  } as QueryFormData;
  return { formData, hiddenFormData: state.hiddenFormData ?? {} };
}

export function restoreHistoryFrame(
  state: ExploreState,
  frame: ExploreHistoryFrame,
): Pick<ExploreState, 'form_data' | 'controls' | 'hiddenFormData'> {
  // `getControlsState` runs each control's `mapStateToProps`, and those read
  // sibling control values (Separator's `code.language` reads
  // `state.controls.markup_type.value`) and `state.form_data` (Handlebars'
  // `handlebarsTemplate`). Both must describe the frame being restored to,
  // not the live state. `form_data` in particular matters for falsy values:
  // `applyMapStateToPropsToControl` keeps the incoming value only when it is
  // truthy, so a stale `form_data` would win over a restored empty value.
  const targetControls = mapValues(frame.formData, value => ({
    value,
  })) as unknown as ControlStateMapping;
  return {
    form_data: frame.formData,
    hiddenFormData: frame.hiddenFormData,
    controls: getControlsState(
      {
        ...state,
        form_data: frame.formData,
        controls: targetControls,
      } as Parameters<typeof getControlsState>[0],
      frame.formData,
    ) as ControlStateMapping,
  };
}
