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

/**
 * Tests for the matrixify_enable guard in isMatrixifyVisible() and
 * validator injection via mapStateToProps on real matrixify control definitions.
 *
 * These are TDD tests for the fix to apache/superset#38519 regression:
 * isMatrixifyVisible() must check matrixify_enable before evaluating mode,
 * otherwise pre-revamp charts with stale matrixify_mode defaults trigger
 * hidden validators that block save.
 */

import {
  matrixifyControls,
  isMatrixifyVisible,
} from '../../src/shared-controls/matrixifyControls';
import type { ControlPanelState, ControlStateMapping } from '../../src/types';

// Helper: build a minimal controls object for ControlPanelState
const buildControls = (
  overrides: Record<string, any> = {},
): ControlStateMapping => {
  const controls: Record<string, { value: any }> = {};
  Object.entries(overrides).forEach(([key, value]) => {
    controls[key] = { value };
  });
  return controls as ControlStateMapping;
};

// Helper: build a minimal ControlPanelState for mapStateToProps.
// Only provides fields that isMatrixifyVisible and mapStateToProps actually read.
const buildState = (
  controlValues: Record<string, any> = {},
  formData: Record<string, any> = {},
) =>
  ({
    controls: buildControls(controlValues),
    datasource: { columns: [], type: 'table' },
    form_data: formData,
    common: {},
    metadata: {},
    slice: { slice_id: 0 },
  }) as unknown as ControlPanelState;

// ============================================================
// Validator injection tests via real mapStateToProps (rows)
// ============================================================

// --- matrixify_dimension_rows ---

test('matrixify_dimension_rows: validators empty when matrixify_enable is falsy', () => {
  const control = matrixifyControls.matrixify_dimension_rows;
  const state = buildState(
    {
      matrixify_enable: undefined,
      matrixify_mode_rows: 'dimensions',
      matrixify_dimension_selection_mode_rows: 'members',
    },
    { matrixify_mode_rows: 'dimensions' },
  );

  const result = control.mapStateToProps!(state, {} as any);
  expect(result.validators).toEqual([]);
});

test('matrixify_dimension_rows: validators present when matrixify_enable is true', () => {
  const control = matrixifyControls.matrixify_dimension_rows;
  const state = buildState(
    {
      matrixify_enable: true,
      matrixify_mode_rows: 'dimensions',
      matrixify_dimension_selection_mode_rows: 'members',
    },
    { matrixify_mode_rows: 'dimensions' },
  );

  const result = control.mapStateToProps!(state, {} as any);
  expect(result.validators.length).toBeGreaterThan(0);
});

// --- matrixify_topn_value_rows ---

test('matrixify_topn_value_rows: validators empty when matrixify_enable is falsy', () => {
  const control = matrixifyControls.matrixify_topn_value_rows;
  const state = buildState(
    {
      matrixify_enable: undefined,
      matrixify_mode_rows: 'dimensions',
      matrixify_dimension_selection_mode_rows: 'topn',
    },
    { matrixify_mode_rows: 'dimensions' },
  );

  const result = control.mapStateToProps!(state, {} as any);
  expect(result.validators).toEqual([]);
});

test('matrixify_topn_value_rows: validators present when matrixify_enable is true', () => {
  const control = matrixifyControls.matrixify_topn_value_rows;
  const state = buildState(
    {
      matrixify_enable: true,
      matrixify_mode_rows: 'dimensions',
      matrixify_dimension_selection_mode_rows: 'topn',
    },
    { matrixify_mode_rows: 'dimensions' },
  );

  const result = control.mapStateToProps!(state, {} as any);
  expect(result.validators.length).toBeGreaterThan(0);
});

// --- matrixify_topn_metric_rows ---

test('matrixify_topn_metric_rows: validators empty when matrixify_enable is falsy', () => {
  const control = matrixifyControls.matrixify_topn_metric_rows;
  const state = buildState(
    {
      matrixify_enable: undefined,
      matrixify_mode_rows: 'dimensions',
      matrixify_dimension_selection_mode_rows: 'topn',
    },
    { matrixify_mode_rows: 'dimensions' },
  );

  const result = control.mapStateToProps!(state, {} as any);
  expect(result.validators).toEqual([]);
});

test('matrixify_topn_metric_rows: validators present when matrixify_enable is true', () => {
  const control = matrixifyControls.matrixify_topn_metric_rows;
  const state = buildState(
    {
      matrixify_enable: true,
      matrixify_mode_rows: 'dimensions',
      matrixify_dimension_selection_mode_rows: 'topn',
    },
    { matrixify_mode_rows: 'dimensions' },
  );

  const result = control.mapStateToProps!(state, {} as any);
  expect(result.validators.length).toBeGreaterThan(0);
});

// ============================================================
// Validator injection tests via real mapStateToProps (columns)
// ============================================================

test('matrixify_dimension_columns: validators empty when matrixify_enable is falsy', () => {
  const control = matrixifyControls.matrixify_dimension_columns;
  const state = buildState(
    {
      matrixify_enable: undefined,
      matrixify_mode_columns: 'dimensions',
      matrixify_dimension_selection_mode_columns: 'members',
    },
    { matrixify_mode_columns: 'dimensions' },
  );

  const result = control.mapStateToProps!(state, {} as any);
  expect(result.validators).toEqual([]);
});

test('matrixify_dimension_columns: validators present when matrixify_enable is true', () => {
  const control = matrixifyControls.matrixify_dimension_columns;
  const state = buildState(
    {
      matrixify_enable: true,
      matrixify_mode_columns: 'dimensions',
      matrixify_dimension_selection_mode_columns: 'members',
    },
    { matrixify_mode_columns: 'dimensions' },
  );

  const result = control.mapStateToProps!(state, {} as any);
  expect(result.validators.length).toBeGreaterThan(0);
});

// ============================================================
// Direct isMatrixifyVisible guard tests
// ============================================================

test.each([
  ['undefined', undefined],
  ['null', null],
  ['false', false],
  ['0', 0],
])(
  'isMatrixifyVisible returns false when matrixify_enable is %s',
  (_, value) => {
    const controls = buildControls({
      matrixify_enable: value,
      matrixify_mode_rows: 'dimensions',
    });
    expect(isMatrixifyVisible(controls, 'rows')).toBe(false);
  },
);

test('isMatrixifyVisible returns true when matrixify_enable is true and mode matches', () => {
  const controls = buildControls({
    matrixify_enable: true,
    matrixify_mode_rows: 'dimensions',
  });
  expect(isMatrixifyVisible(controls, 'rows', 'dimensions')).toBe(true);
});

test('isMatrixifyVisible returns false when matrixify_enable is true but mode is disabled', () => {
  const controls = buildControls({
    matrixify_enable: true,
    matrixify_mode_rows: 'disabled',
  });
  expect(isMatrixifyVisible(controls, 'rows')).toBe(false);
});

test('isMatrixifyVisible returns true when matrixify_enable is true and any non-disabled mode (no mode filter)', () => {
  const controls = buildControls({
    matrixify_enable: true,
    matrixify_mode_columns: 'metrics',
  });
  expect(isMatrixifyVisible(controls, 'columns')).toBe(true);
});
