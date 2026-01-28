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

import { ControlPanelState } from '../../src/types';

// Mock the utilities to avoid complex dependencies
jest.mock('../../src/utils', () => ({
  formatSelectOptions: jest.fn((options: any[]) =>
    options.map((opt: any) => [opt, opt]),
  ),
  displayTimeRelatedControls: jest.fn(() => true),
  getColorControlsProps: jest.fn(() => ({})),
  D3_FORMAT_OPTIONS: [],
  D3_FORMAT_DOCS: '',
  D3_TIME_FORMAT_OPTIONS: [],
  D3_TIME_FORMAT_DOCS: '',
  DEFAULT_TIME_FORMAT: '%Y-%m-%d',
  DEFAULT_NUMBER_FORMAT: '',
}));

// Mock shared controls
const mockSharedControls = {
  matrixify_dimension_x: {
    shouldMapStateToProps: (
      prevState: ControlPanelState,
      state: ControlPanelState,
    ) => {
      const fieldsToCheck = [
        'matrixify_topn_value_x',
        'matrixify_topn_metric_x',
        'matrixify_topn_order_x',
        'matrixify_dimension_selection_mode_x',
      ];
      return fieldsToCheck.some(
        field => prevState?.form_data?.[field] !== state?.form_data?.[field],
      );
    },
    mapStateToProps: ({ datasource, controls, form_data }: any) => {
      const getValue = (key: string, defaultValue?: any) =>
        form_data?.[key] ?? controls?.[key]?.value ?? defaultValue;

      return {
        datasource,
        selectionMode: getValue(
          'matrixify_dimension_selection_mode_x',
          'members',
        ),
        topNMetric: getValue('matrixify_topn_metric_x'),
        topNValue: getValue('matrixify_topn_value_x'),
        topNOrder: getValue('matrixify_topn_order_x'),
        formData: form_data,
      };
    },
  },
  matrixify_dimension_y: {
    shouldMapStateToProps: (
      prevState: ControlPanelState,
      state: ControlPanelState,
    ) => {
      const fieldsToCheck = [
        'matrixify_topn_value_y',
        'matrixify_topn_metric_y',
        'matrixify_topn_order_y',
        'matrixify_dimension_selection_mode_y',
      ];
      return fieldsToCheck.some(
        field => prevState?.form_data?.[field] !== state?.form_data?.[field],
      );
    },
    mapStateToProps: ({ datasource, controls, form_data }: any) => {
      const getValue = (key: string, defaultValue?: any) =>
        form_data?.[key] ?? controls?.[key]?.value ?? defaultValue;

      return {
        datasource,
        selectionMode: getValue(
          'matrixify_dimension_selection_mode_y',
          'members',
        ),
        topNMetric: getValue('matrixify_topn_metric_y'),
        topNValue: getValue('matrixify_topn_value_y'),
        topNOrder: getValue('matrixify_topn_order_y'),
        formData: form_data,
      };
    },
  },
};

const createMockState = (
  formData: any = {},
  controls: any = {},
): ControlPanelState => ({
  slice: { slice_id: 123 },
  form_data: formData,
  datasource: null,
  controls,
  common: {},
  metadata: {},
});

const createMockControlState = (value: any = null) => ({ value });

test('matrixify_dimension_x should return true when topN value changes', () => {
  const control = mockSharedControls.matrixify_dimension_x;

  const prevState = createMockState({
    matrixify_topn_value_x: 5,
    matrixify_topn_metric_x: 'metric1',
    matrixify_topn_order_x: 'desc',
    matrixify_dimension_selection_mode_x: 'topn',
  });

  const nextState = createMockState({
    matrixify_topn_value_x: 10, // Changed
    matrixify_topn_metric_x: 'metric1',
    matrixify_topn_order_x: 'desc',
    matrixify_dimension_selection_mode_x: 'topn',
  });

  expect(control.shouldMapStateToProps!(prevState, nextState)).toBe(true);
});

test('matrixify_dimension_x should return true when topN metric changes', () => {
  const control = mockSharedControls.matrixify_dimension_x;

  const prevState = createMockState({
    matrixify_topn_value_x: 5,
    matrixify_topn_metric_x: 'metric1',
    matrixify_topn_order_x: 'desc',
    matrixify_dimension_selection_mode_x: 'topn',
  });

  const nextState = createMockState({
    matrixify_topn_value_x: 5,
    matrixify_topn_metric_x: 'metric2', // Changed
    matrixify_topn_order_x: 'desc',
    matrixify_dimension_selection_mode_x: 'topn',
  });

  expect(control.shouldMapStateToProps!(prevState, nextState)).toBe(true);
});

test('matrixify_dimension_x should return true when topN order changes', () => {
  const control = mockSharedControls.matrixify_dimension_x;

  const prevState = createMockState({
    matrixify_topn_value_x: 5,
    matrixify_topn_metric_x: 'metric1',
    matrixify_topn_order_x: 'desc',
    matrixify_dimension_selection_mode_x: 'topn',
  });

  const nextState = createMockState({
    matrixify_topn_value_x: 5,
    matrixify_topn_metric_x: 'metric1',
    matrixify_topn_order_x: 'asc', // Changed
    matrixify_dimension_selection_mode_x: 'topn',
  });

  expect(control.shouldMapStateToProps!(prevState, nextState)).toBe(true);
});

test('matrixify_dimension_x should return true when selection mode changes', () => {
  const control = mockSharedControls.matrixify_dimension_x;

  const prevState = createMockState({
    matrixify_topn_value_x: 5,
    matrixify_topn_metric_x: 'metric1',
    matrixify_topn_order_x: 'desc',
    matrixify_dimension_selection_mode_x: 'topn',
  });

  const nextState = createMockState({
    matrixify_topn_value_x: 5,
    matrixify_topn_metric_x: 'metric1',
    matrixify_topn_order_x: 'desc',
    matrixify_dimension_selection_mode_x: 'members', // Changed
  });

  expect(control.shouldMapStateToProps!(prevState, nextState)).toBe(true);
});

test('matrixify_dimension_x should return false when no relevant fields change', () => {
  const control = mockSharedControls.matrixify_dimension_x;

  const prevState = createMockState({
    matrixify_topn_value_x: 5,
    matrixify_topn_metric_x: 'metric1',
    matrixify_topn_order_x: 'desc',
    matrixify_dimension_selection_mode_x: 'topn',
    unrelated_field: 'value1',
  });

  const nextState = createMockState({
    matrixify_topn_value_x: 5,
    matrixify_topn_metric_x: 'metric1',
    matrixify_topn_order_x: 'desc',
    matrixify_dimension_selection_mode_x: 'topn',
    unrelated_field: 'value2', // Changed, but not relevant
  });

  expect(control.shouldMapStateToProps!(prevState, nextState)).toBe(false);
});

test('matrixify_dimension_x should return false when states are identical', () => {
  const control = mockSharedControls.matrixify_dimension_x;

  const state = createMockState({
    matrixify_topn_value_x: 5,
    matrixify_topn_metric_x: 'metric1',
    matrixify_topn_order_x: 'desc',
    matrixify_dimension_selection_mode_x: 'topn',
  });

  expect(control.shouldMapStateToProps!(state, state)).toBe(false);
});

test('matrixify_dimension_x should handle missing form_data gracefully', () => {
  const control = mockSharedControls.matrixify_dimension_x;

  const prevState = createMockState(); // No form_data
  const nextState = createMockState({
    matrixify_topn_value_x: 5,
  });

  expect(control.shouldMapStateToProps!(prevState, nextState)).toBe(true);
});

test('matrixify_dimension_x should handle undefined values gracefully', () => {
  const control = mockSharedControls.matrixify_dimension_x;

  const prevState = createMockState({
    matrixify_topn_value_x: undefined,
    matrixify_topn_metric_x: null,
  });

  const nextState = createMockState({
    matrixify_topn_value_x: 5,
    matrixify_topn_metric_x: 'metric1',
  });

  expect(control.shouldMapStateToProps!(prevState, nextState)).toBe(true);
});

test('matrixify_dimension_y should check y-axis specific fields', () => {
  const control = mockSharedControls.matrixify_dimension_y;

  const prevState = createMockState({
    matrixify_topn_value_y: 5,
    matrixify_topn_metric_y: 'metric1',
  });

  const nextState = createMockState({
    matrixify_topn_value_y: 10, // Changed
    matrixify_topn_metric_y: 'metric1',
  });

  expect(control.shouldMapStateToProps!(prevState, nextState)).toBe(true);
});

test('matrixify_dimension_y should not trigger on x-axis changes', () => {
  const control = mockSharedControls.matrixify_dimension_y;

  const prevState = createMockState({
    matrixify_topn_value_x: 5, // x-axis field
    matrixify_topn_value_y: 5, // y-axis field (unchanged)
  });

  const nextState = createMockState({
    matrixify_topn_value_x: 10, // x-axis field changed
    matrixify_topn_value_y: 5, // y-axis field (unchanged)
  });

  expect(control.shouldMapStateToProps!(prevState, nextState)).toBe(false);
});

test('mapStateToProps should map form_data values correctly', () => {
  const control = mockSharedControls.matrixify_dimension_x;

  const state = createMockState({
    matrixify_dimension_selection_mode_x: 'topn',
    matrixify_topn_metric_x: 'metric1',
    matrixify_topn_value_x: 10,
    matrixify_topn_order_x: 'desc',
  });

  const mockDatasource: any = { id: 1, columns: [] };
  state.datasource = mockDatasource;

  const result = control.mapStateToProps!(state);

  expect(result).toEqual({
    datasource: mockDatasource,
    selectionMode: 'topn',
    topNMetric: 'metric1',
    topNValue: 10,
    topNOrder: 'desc',
    formData: state.form_data,
  });
});

test('mapStateToProps should fall back to control values when form_data is missing', () => {
  const control = mockSharedControls.matrixify_dimension_x;

  const state = createMockState(
    {}, // Empty form_data
    {
      matrixify_dimension_selection_mode_x: createMockControlState('members'),
      matrixify_topn_metric_x: createMockControlState('metric2'),
      matrixify_topn_value_x: createMockControlState(15),
    },
  );

  const result = control.mapStateToProps!(state);

  expect(result.selectionMode).toBe('members');
  expect(result.topNMetric).toBe('metric2');
  expect(result.topNValue).toBe(15);
});

test('mapStateToProps should use default values when both form_data and controls are missing', () => {
  const control = mockSharedControls.matrixify_dimension_x;

  const state = createMockState({}, {});

  const result = control.mapStateToProps!(state);

  expect(result.selectionMode).toBe('members'); // Default value
  expect(result.topNMetric).toBeUndefined();
  expect(result.topNValue).toBeUndefined();
  expect(result.topNOrder).toBeUndefined();
});

test('mapStateToProps should prioritize form_data over control values', () => {
  const control = mockSharedControls.matrixify_dimension_x;

  const state = createMockState(
    {
      matrixify_dimension_selection_mode_x: 'topn', // form_data value
    },
    {
      matrixify_dimension_selection_mode_x: createMockControlState('members'), // control value
    },
  );

  const result = control.mapStateToProps!(state);

  expect(result.selectionMode).toBe('topn'); // Should use form_data value
});

test('should efficiently check only relevant fields', () => {
  const control = mockSharedControls.matrixify_dimension_x;

  const prevState = createMockState({
    // Many fields, only some relevant
    field1: 'value1',
    field2: 'value2',
    matrixify_topn_value_x: 5, // Relevant
    field3: 'value3',
    matrixify_topn_metric_x: 'metric1', // Relevant
    field4: 'value4',
    matrixify_other_control: 'value5',
  });

  const nextState = createMockState({
    field1: 'value1_changed', // Not relevant
    field2: 'value2_changed', // Not relevant
    matrixify_topn_value_x: 5, // Relevant, unchanged
    field3: 'value3_changed', // Not relevant
    matrixify_topn_metric_x: 'metric1', // Relevant, unchanged
    field4: 'value4_changed', // Not relevant
    matrixify_other_control: 'value5_changed', // Not relevant
  });

  // Should return false because no relevant fields changed
  expect(control.shouldMapStateToProps!(prevState, nextState)).toBe(false);
});
