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
import { applyDefaultFormData, getControlsState } from 'src/explore/store';

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
// Migration tests: handleDeprecatedControls cleans stale matrixify modes
// (TDD: tests for fix to apache/superset#38519 regression)
// ============================================================

test('getControlsState resets stale matrixify_mode_rows to disabled when matrixify_enable key absent', () => {
  const state = buildExploreState();
  const formData = {
    datasource: '1__table',
    viz_type: 'test-chart',
    matrixify_mode_rows: 'dimensions', // stale in form_data
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
    matrixify_mode_columns: 'metrics', // stale in form_data
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
  // matrixify_enable key IS present (just false) — migration should NOT fire
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

test('applyDefaultFormData with pre-revamp form_data: stale modes pass through but are harmless', () => {
  // Documents dashboard hydration behavior: applyDefaultFormData passes null
  // state to getAllControlsState, so mapStateToProps is never invoked and
  // validators are never injected. Stale matrixify modes pass through unchanged
  // but cannot cause validation errors on this path. The runtime guard in
  // isMatrixifyVisible covers the case where controls ARE evaluated with state
  // (e.g., re-render after dashboard hydration).
  const preRevampFormData = {
    datasource: '1__table',
    viz_type: 'test-chart',
    matrixify_mode_rows: 'dimensions',
    matrixify_mode_columns: 'metrics',
    // No matrixify_enable key — legacy chart
  };

  const outputFormData = applyDefaultFormData(preRevampFormData as any);

  // Stale values pass through (no handleDeprecatedControls on this path)
  expect(outputFormData.matrixify_mode_rows).toBe('dimensions');
  expect(outputFormData.matrixify_mode_columns).toBe('metrics');
  // matrixify_enable gets its default (false) from the control definition
  expect(outputFormData.matrixify_enable).toBe(false);
});
