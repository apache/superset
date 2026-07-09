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

import { isMatrixifyVisible } from './matrixifyControls';
import type { ControlStateMapping } from '../types';

/**
 * Helper to build a controls object matching the shape used by
 * control panel visibility callbacks.
 */
function makeControls(
  overrides: Record<string, unknown> = {},
): ControlStateMapping {
  const defaults: Record<string, unknown> = {
    matrixify_enable: false,
    matrixify_mode_rows: 'disabled',
    matrixify_mode_columns: 'disabled',
    matrixify_dimension_selection_mode_rows: 'members',
    matrixify_dimension_selection_mode_columns: 'members',
  };
  const merged = { ...defaults, ...overrides };
  return Object.fromEntries(
    Object.entries(merged).map(([k, v]) => [k, { value: v }]),
  ) as ControlStateMapping;
}

// ── matrixify_enable guard ──────────────────────────────────────────

test('returns false when matrixify_enable is false, even with active axis modes', () => {
  const controls = makeControls({
    matrixify_enable: false,
    matrixify_mode_rows: 'metrics',
    matrixify_mode_columns: 'dimensions',
  });
  expect(isMatrixifyVisible(controls, 'rows')).toBe(false);
  expect(isMatrixifyVisible(controls, 'columns')).toBe(false);
});

test('returns false when matrixify_enable is undefined (old form_data without the field)', () => {
  const controls = makeControls({
    matrixify_mode_rows: 'metrics',
  });
  delete (controls as any).matrixify_enable;
  expect(isMatrixifyVisible(controls, 'rows')).toBe(false);
});

test('returns false when controls object is undefined', () => {
  expect(isMatrixifyVisible(undefined, 'rows')).toBe(false);
});

// ── axis mode checks ────────────────────────────────────────────────

test('returns false when axis mode is disabled', () => {
  const controls = makeControls({
    matrixify_enable: true,
    matrixify_mode_rows: 'disabled',
  });
  expect(isMatrixifyVisible(controls, 'rows')).toBe(false);
});

test('returns true when matrixify_enable is true and axis mode is metrics', () => {
  const controls = makeControls({
    matrixify_enable: true,
    matrixify_mode_rows: 'metrics',
  });
  expect(isMatrixifyVisible(controls, 'rows')).toBe(true);
});

test('returns true when matrixify_enable is true and axis mode is dimensions', () => {
  const controls = makeControls({
    matrixify_enable: true,
    matrixify_mode_columns: 'dimensions',
  });
  expect(isMatrixifyVisible(controls, 'columns')).toBe(true);
});

// ── mode filter ─────────────────────────────────────────────────────

test('returns false when mode filter does not match axis value', () => {
  const controls = makeControls({
    matrixify_enable: true,
    matrixify_mode_rows: 'metrics',
  });
  expect(isMatrixifyVisible(controls, 'rows', 'dimensions')).toBe(false);
});

test('returns true when mode filter matches axis value', () => {
  const controls = makeControls({
    matrixify_enable: true,
    matrixify_mode_rows: 'dimensions',
  });
  expect(isMatrixifyVisible(controls, 'rows', 'dimensions')).toBe(true);
});

// ── selectionMode filter ────────────────────────────────────────────

test('returns true when selectionMode matches', () => {
  const controls = makeControls({
    matrixify_enable: true,
    matrixify_mode_rows: 'dimensions',
    matrixify_dimension_selection_mode_rows: 'topn',
  });
  expect(isMatrixifyVisible(controls, 'rows', 'dimensions', 'topn')).toBe(true);
});

test('returns false when selectionMode does not match', () => {
  const controls = makeControls({
    matrixify_enable: true,
    matrixify_mode_rows: 'dimensions',
    matrixify_dimension_selection_mode_rows: 'members',
  });
  expect(isMatrixifyVisible(controls, 'rows', 'dimensions', 'topn')).toBe(
    false,
  );
});

test('ignores selectionMode filter when mode is metrics', () => {
  const controls = makeControls({
    matrixify_enable: true,
    matrixify_mode_columns: 'metrics',
  });
  // selectionMode only applies to dimensions mode, should be ignored
  expect(isMatrixifyVisible(controls, 'columns', 'metrics', 'topn')).toBe(true);
});
