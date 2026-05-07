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
import { getChartControlPanelRegistry } from '@superset-ui/core';
import {
  applyDefaultFormData,
  getControlsState,
  handleDeprecatedControls,
} from 'src/explore/store';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).featureFlags = {};

beforeAll(() => {
  getChartControlPanelRegistry().registerValue('test-chart', {
    controlPanelSections: [
      {
        label: 'Test section',
        expanded: true,
        controlSetRows: [['row_limit']],
      },
    ],
  });
});

afterAll(() => {
  getChartControlPanelRegistry().remove('test-chart');
});

// Helper: build ExploreState for getControlsState
const buildExploreState = (controlOverrides: Record<string, any> = {}) => ({
  datasource: { type: 'table' },
  controls: Object.fromEntries(
    Object.entries(controlOverrides).map(([k, v]) => [k, { value: v }]),
  ),
});

// ============================================================
// Existing applyDefaultFormData tests
// ============================================================

test('applyDefaultFormData applies default to formData if the key is missing', () => {
  const inputFormData = {
    datasource: '11_table',
    viz_type: 'test-chart',
  };
  let outputFormData = applyDefaultFormData(inputFormData);
  expect(outputFormData.row_limit).toEqual(10000);

  const inputWithRowLimit = {
    ...inputFormData,
    row_limit: 888,
  };
  outputFormData = applyDefaultFormData(inputWithRowLimit);
  expect(outputFormData.row_limit).toEqual(888);
});

test('applyDefaultFormData keeps null if key is defined with null', () => {
  const inputFormData = {
    datasource: '11_table',
    viz_type: 'test-chart',
    row_limit: null,
  };
  const outputFormData = applyDefaultFormData(inputFormData);
  expect(outputFormData.row_limit).toBe(null);
});

// ============================================================
// Migration tests: handleDeprecatedControls normalizes stale matrixify modes
// (fix for apache/superset#38519 regression — guards validators AND
// downstream UI consumers that infer matrixify state from mode values)
// ============================================================

test('getControlsState resets stale matrixify_mode_rows to disabled when matrixify_enable key absent', () => {
  const state = buildExploreState();
  const formData = {
    datasource: '1__table',
    viz_type: 'test-chart',
    matrixify_mode_rows: 'dimensions', // stale pre-revamp default
  };

  const result = getControlsState(state as any, formData as any);
  const modeControl = result.matrixify_mode_rows as any;
  expect(modeControl?.value).toBe('disabled');
});

test('getControlsState resets stale matrixify_mode_columns to disabled when matrixify_enable key absent', () => {
  const state = buildExploreState();
  const formData = {
    datasource: '1__table',
    viz_type: 'test-chart',
    matrixify_mode_columns: 'metrics', // stale pre-revamp default
  };

  const result = getControlsState(state as any, formData as any);
  const modeControl = result.matrixify_mode_columns as any;
  expect(modeControl?.value).toBe('disabled');
});

test('getControlsState preserves matrixify mode values when matrixify_enable is true', () => {
  const state = buildExploreState();
  const formData = {
    datasource: '1__table',
    viz_type: 'test-chart',
    matrixify_enable: true,
    matrixify_mode_rows: 'dimensions',
  };

  const result = getControlsState(state as any, formData as any);
  const modeControl = result.matrixify_mode_rows as any;
  expect(modeControl?.value).toBe('dimensions');
});

test('getControlsState preserves matrixify mode values when matrixify_enable is explicitly false', () => {
  const state = buildExploreState();
  const formData = {
    datasource: '1__table',
    viz_type: 'test-chart',
    matrixify_enable: false,
    matrixify_mode_rows: 'dimensions',
  };

  const result = getControlsState(state as any, formData as any);
  const modeControl = result.matrixify_mode_rows as any;
  // matrixify_enable key IS present (just false) — migration does NOT fire
  expect(modeControl?.value).toBe('dimensions');
});

test('getControlsState is idempotent when matrixify modes already disabled', () => {
  const state = buildExploreState();
  const formData = {
    datasource: '1__table',
    viz_type: 'test-chart',
    matrixify_mode_rows: 'disabled',
    matrixify_mode_columns: 'disabled',
  };

  const result = getControlsState(state as any, formData as any);
  expect((result.matrixify_mode_rows as any)?.value).toBe('disabled');
  expect((result.matrixify_mode_columns as any)?.value).toBe('disabled');
});

test('getControlsState handles form_data with no matrixify keys', () => {
  const state = buildExploreState();
  const formData = {
    datasource: '1__table',
    viz_type: 'test-chart',
  };

  const result = getControlsState(state as any, formData as any);
  // Controls should get their defaults — matrixify_mode defaults to 'disabled'
  expect((result.matrixify_mode_rows as any)?.value).toBe('disabled');
  expect((result.matrixify_mode_columns as any)?.value).toBe('disabled');
});

test('getControlsState round-trip: pre-revamp form_data produces no matrixify validation errors', () => {
  // Simulate a chart saved before #38519 with stale matrixify defaults
  // Empty controls: on real first-load hydration, no pre-existing controls exist
  const state = buildExploreState();
  const preRevampFormData = {
    datasource: '1__table',
    viz_type: 'test-chart',
    // Stale old defaults — no matrixify_enable key (legacy chart)
    matrixify_mode_rows: 'dimensions',
    matrixify_mode_columns: 'metrics',
  };

  const result = getControlsState(state as any, preRevampFormData as any);

  // Every matrixify control should have zero validation errors
  const matrixifyControlEntries = Object.entries(result).filter(([name]) =>
    name.startsWith('matrixify_'),
  );
  const controlsWithErrors = matrixifyControlEntries.filter(
    ([, control]) => (control as any)?.validationErrors?.length > 0,
  );

  expect(controlsWithErrors).toEqual([]);
});

// ============================================================
// Dashboard hydration: applyDefaultFormData with stale form_data
// ============================================================

test('applyDefaultFormData normalizes stale matrixify modes for legacy charts', () => {
  // Dashboard hydration now runs handleDeprecatedControls too, so stale
  // matrixify modes from pre-revamp charts are normalized to 'disabled'.
  // This protects downstream consumers (ChartContextMenu, DrillBySubmenu,
  // ChartRenderer) that infer "matrixify is active" from mode values alone.
  const preRevampFormData = {
    datasource: '1__table',
    viz_type: 'test-chart',
    matrixify_mode_rows: 'dimensions',
    matrixify_mode_columns: 'metrics',
    // No matrixify_enable key — legacy chart that never used matrixify
  };

  const outputFormData = applyDefaultFormData(preRevampFormData as any);

  // Stale values are now normalized to 'disabled'
  expect(outputFormData.matrixify_mode_rows).toBe('disabled');
  expect(outputFormData.matrixify_mode_columns).toBe('disabled');
  expect(outputFormData.matrixify_enable).toBe(false);
});

// ============================================================
// P1: Pre-revamp charts that actually used matrixify via old per-axis flags
// (matrixify_enable_vertical_layout / matrixify_enable_horizontal_layout)
// ============================================================

test('getControlsState preserves modes and sets matrixify_enable when old vertical flag is true', () => {
  const state = buildExploreState();
  const formData = {
    datasource: '1__table',
    viz_type: 'test-chart',
    matrixify_enable_vertical_layout: true,
    matrixify_mode_rows: 'dimensions',
    matrixify_mode_columns: 'metrics',
  };

  const result = getControlsState(state as any, formData as any);
  // Vertical layout was enabled — rows mode preserved, matrixify_enable migrated
  expect((result.matrixify_mode_rows as any)?.value).toBe('dimensions');
  expect((result.matrixify_enable as any)?.value).toBe(true);
  // Horizontal layout was NOT enabled — columns mode reset
  expect((result.matrixify_mode_columns as any)?.value).toBe('disabled');
});

test('getControlsState preserves modes and sets matrixify_enable when old horizontal flag is true', () => {
  const state = buildExploreState();
  const formData = {
    datasource: '1__table',
    viz_type: 'test-chart',
    matrixify_enable_horizontal_layout: true,
    matrixify_mode_rows: 'dimensions',
    matrixify_mode_columns: 'metrics',
  };

  const result = getControlsState(state as any, formData as any);
  // Horizontal layout was enabled — columns mode preserved, matrixify_enable migrated
  expect((result.matrixify_mode_columns as any)?.value).toBe('metrics');
  expect((result.matrixify_enable as any)?.value).toBe(true);
  // Vertical layout was NOT enabled — rows mode reset
  expect((result.matrixify_mode_rows as any)?.value).toBe('disabled');
});

test('getControlsState preserves both modes when both old per-axis flags are true', () => {
  const state = buildExploreState();
  const formData = {
    datasource: '1__table',
    viz_type: 'test-chart',
    matrixify_enable_vertical_layout: true,
    matrixify_enable_horizontal_layout: true,
    matrixify_mode_rows: 'dimensions',
    matrixify_mode_columns: 'metrics',
  };

  const result = getControlsState(state as any, formData as any);
  expect((result.matrixify_mode_rows as any)?.value).toBe('dimensions');
  expect((result.matrixify_mode_columns as any)?.value).toBe('metrics');
  expect((result.matrixify_enable as any)?.value).toBe(true);
});

test('getControlsState resets modes when old per-axis flags are explicitly false', () => {
  const state = buildExploreState();
  const formData = {
    datasource: '1__table',
    viz_type: 'test-chart',
    matrixify_enable_vertical_layout: false,
    matrixify_enable_horizontal_layout: false,
    matrixify_mode_rows: 'dimensions',
    matrixify_mode_columns: 'metrics',
  };

  const result = getControlsState(state as any, formData as any);
  // Old flags present but false — chart never used matrixify, reset stale modes
  expect((result.matrixify_mode_rows as any)?.value).toBe('disabled');
  expect((result.matrixify_mode_columns as any)?.value).toBe('disabled');
});

// ============================================================
// P2: Dashboard hydration (applyDefaultFormData) with old per-axis flags
// ============================================================

test('applyDefaultFormData preserves modes when old vertical flag is true', () => {
  const formData = {
    datasource: '1__table',
    viz_type: 'test-chart',
    matrixify_enable_vertical_layout: true,
    matrixify_mode_rows: 'dimensions',
    matrixify_mode_columns: 'metrics',
  };

  const outputFormData = applyDefaultFormData(formData as any);
  expect(outputFormData.matrixify_mode_rows).toBe('dimensions');
  expect(outputFormData.matrixify_enable).toBe(true);
  // Horizontal not enabled — columns reset
  expect(outputFormData.matrixify_mode_columns).toBe('disabled');
});

test('applyDefaultFormData preserves modes when both old flags are true', () => {
  const formData = {
    datasource: '1__table',
    viz_type: 'test-chart',
    matrixify_enable_vertical_layout: true,
    matrixify_enable_horizontal_layout: true,
    matrixify_mode_rows: 'dimensions',
    matrixify_mode_columns: 'metrics',
  };

  const outputFormData = applyDefaultFormData(formData as any);
  expect(outputFormData.matrixify_mode_rows).toBe('dimensions');
  expect(outputFormData.matrixify_mode_columns).toBe('metrics');
  expect(outputFormData.matrixify_enable).toBe(true);
});

// ============================================================
// Direct handleDeprecatedControls tests: verify form_data mutation
// so callers (hydrateExplore) can propagate migrated fields into state
// ============================================================

test('handleDeprecatedControls sets matrixify_enable on form_data when old vertical flag is true', () => {
  const formData: any = {
    matrixify_enable_vertical_layout: true,
    matrixify_mode_rows: 'dimensions',
    matrixify_mode_columns: 'metrics',
  };
  handleDeprecatedControls(formData);

  expect(formData.matrixify_enable).toBe(true);
  expect(formData.matrixify_mode_rows).toBe('dimensions');
  // Horizontal not enabled — columns reset
  expect(formData.matrixify_mode_columns).toBe('disabled');
});

test('handleDeprecatedControls resets modes when no matrixify_enable and no old flags', () => {
  const formData: any = {
    matrixify_mode_rows: 'dimensions',
    matrixify_mode_columns: 'metrics',
  };
  handleDeprecatedControls(formData);

  expect(formData.matrixify_enable).toBeUndefined();
  expect(formData.matrixify_mode_rows).toBe('disabled');
  expect(formData.matrixify_mode_columns).toBe('disabled');
});

test('handleDeprecatedControls is idempotent — no-op when matrixify_enable already present', () => {
  const formData: any = {
    matrixify_enable: true,
    matrixify_mode_rows: 'dimensions',
    matrixify_mode_columns: 'metrics',
  };
  handleDeprecatedControls(formData);

  // No mutation — matrixify_enable key is present
  expect(formData.matrixify_enable).toBe(true);
  expect(formData.matrixify_mode_rows).toBe('dimensions');
  expect(formData.matrixify_mode_columns).toBe('metrics');
});
