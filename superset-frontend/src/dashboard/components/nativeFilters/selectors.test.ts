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
import { DataMaskType } from '@superset-ui/core';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
import {
  getCrossFilterIndicator,
  getStatus,
  IndicatorStatus,
} from './selectors';

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('getCrossFilterIndicator', () => {
  const chartId = 123;
  const chartLayoutItems = [
    {
      id: 'chart-123',
      type: CHART_TYPE,
      children: [],
      parents: ['ROOT_ID'],
      meta: {
        chartId,
        sliceName: 'Test Chart',
        uuid: 'uuid-123',
        height: 10,
        width: 10,
      },
    },
  ];

  test('returns correct indicator with label from filterState.label', () => {
    const dataMask = {
      filterState: { label: 'foo', value: 'bar' },
      extraFormData: {},
    };
    const result = getCrossFilterIndicator(chartId, dataMask, chartLayoutItems);
    expect(result).toEqual({
      column: undefined,
      name: 'Test Chart',
      path: ['ROOT_ID', 'chart-123'],
      value: 'foo',
    });
  });

  test('returns correct indicator with label from filterState.value', () => {
    const dataMask = {
      filterState: { value: ['bar', 'baz'] },
      extraFormData: {},
    };
    const result = getCrossFilterIndicator(chartId, dataMask, chartLayoutItems);
    expect(result).toEqual({
      column: undefined,
      name: 'Test Chart',
      path: ['ROOT_ID', 'chart-123'],
      value: 'bar, baz',
    });
  });

  test('returns correct indicator with column and customColumnLabel', () => {
    const dataMask = {
      filterState: {
        value: 'valA',
        filters: { col: 'col' },
        customColumnLabel: 'label',
      },
      extraFormData: {},
    };
    const result = getCrossFilterIndicator(chartId, dataMask, chartLayoutItems);
    expect(result).toEqual({
      column: 'col',
      name: 'Test Chart',
      path: ['ROOT_ID', 'chart-123'],
      value: 'valA',
      customColumnLabel: 'label',
    });
  });

  test('returns correct indicator with column from extraFormData.filters', () => {
    const filterClause = { col: 'colB', op: 'IS NOT NULL' as const };
    const dataMask = {
      filterState: { value: 'valB' },
      extraFormData: { filters: [filterClause] },
    };
    const result = getCrossFilterIndicator(chartId, dataMask, chartLayoutItems);
    expect(result).toEqual({
      column: 'colB',
      name: 'Test Chart',
      path: ['ROOT_ID', 'chart-123'],
      value: 'valB',
    });
  });

  test('returns correct indicator with column from filterState.filters', () => {
    const dataMask = {
      filterState: { value: 'valC', filters: { colC: 'something' } },
      extraFormData: {},
    };
    const result = getCrossFilterIndicator(chartId, dataMask, chartLayoutItems);
    expect(result).toEqual({
      column: 'colC',
      name: 'Test Chart',
      path: ['ROOT_ID', 'chart-123'],
      value: 'valC',
    });
  });

  test('returns empty name and path if chartLayoutItem is not found', () => {
    const dataMask = {
      filterState: { value: 'valD' },
      extraFormData: {},
    };
    const result = getCrossFilterIndicator(999, dataMask, chartLayoutItems);
    expect(result).toEqual({
      column: undefined,
      name: '',
      path: [''],
      value: 'valD',
    });
  });

  test('returns null value if no label or value in filterState', () => {
    const dataMask = {
      filterState: {},
      extraFormData: {},
    };
    const result = getCrossFilterIndicator(chartId, dataMask, chartLayoutItems);
    expect(result).toEqual({
      column: undefined,
      name: 'Test Chart',
      path: ['ROOT_ID', 'chart-123'],
      value: null,
    });
  });
});

test('getStatus returns Applied for filter without column but with value', () => {
  const result = getStatus({
    label: 'some value',
    column: undefined,
    type: DataMaskType.NativeFilters,
  });
  expect(result).toBe(IndicatorStatus.Applied);
});

test('getStatus returns CrossFilterApplied for cross-filter without column but with value', () => {
  const result = getStatus({
    label: 'some value',
    column: undefined,
    type: DataMaskType.CrossFilters,
  });
  expect(result).toBe(IndicatorStatus.CrossFilterApplied);
});

test('getStatus returns Incompatible when column is in rejectedColumns', () => {
  const rejectedColumns = new Set(['rejected_col']);
  const result = getStatus({
    label: 'some value',
    column: 'rejected_col',
    rejectedColumns,
  });
  expect(result).toBe(IndicatorStatus.Incompatible);
});

test('getStatus returns Applied when column has value, is not rejected, and is in appliedColumns', () => {
  const appliedColumns = new Set(['applied_col']);
  const result = getStatus({
    label: 'some value',
    column: 'applied_col',
    appliedColumns,
  });
  expect(result).toBe(IndicatorStatus.Applied);
});

test('getStatus returns CrossFilterApplied when column has value, is not rejected, and is in appliedColumns for cross-filter', () => {
  const appliedColumns = new Set(['applied_col']);
  const result = getStatus({
    label: 'some value',
    column: 'applied_col',
    type: DataMaskType.CrossFilters,
    appliedColumns,
  });
  expect(result).toBe(IndicatorStatus.CrossFilterApplied);
});

test('getStatus returns Applied when column has value, is not rejected, and appliedColumns is empty (chart not loaded)', () => {
  const appliedColumns = new Set<string>();
  const result = getStatus({
    label: 'some value',
    column: 'test_col',
    appliedColumns,
  });
  expect(result).toBe(IndicatorStatus.Applied);
});

test('getStatus returns Applied when column has value, is not rejected, and appliedColumns is undefined (chart not loaded)', () => {
  const result = getStatus({
    label: 'some value',
    column: 'test_col',
    appliedColumns: undefined,
  });
  expect(result).toBe(IndicatorStatus.Applied);
});

test('getStatus returns Applied when column has value, is not rejected, and appliedColumns is null (chart not loaded)', () => {
  const result = getStatus({
    label: 'some value',
    column: 'test_col',
    appliedColumns: null as any,
  });
  expect(result).toBe(IndicatorStatus.Applied);
});

test('getStatus returns Unset when column has value but appliedColumns has other columns (not this one)', () => {
  const appliedColumns = new Set(['other_col']);
  const result = getStatus({
    label: 'some value',
    column: 'test_col',
    appliedColumns,
  });
  expect(result).toBe(IndicatorStatus.Unset);
});

test('getStatus returns Unset when label is null', () => {
  const result = getStatus({
    label: null,
    column: 'test_col',
  });
  expect(result).toBe(IndicatorStatus.Unset);
});

test('getStatus returns Unset when label is null even with appliedColumns', () => {
  const appliedColumns = new Set(['test_col']);
  const result = getStatus({
    label: null,
    column: 'test_col',
    appliedColumns,
  });
  expect(result).toBe(IndicatorStatus.Unset);
});

test('getStatus returns Unset when column has value but is rejected (rejection takes precedence)', () => {
  const rejectedColumns = new Set(['test_col']);
  const appliedColumns = new Set(['test_col']);
  const result = getStatus({
    label: 'some value',
    column: 'test_col',
    rejectedColumns,
    appliedColumns,
  });
  expect(result).toBe(IndicatorStatus.Incompatible);
});

test('getStatus returns Applied for filter without column even when rejectedColumns is provided', () => {
  const rejectedColumns = new Set(['some_col']);
  const result = getStatus({
    label: 'some value',
    column: undefined,
    rejectedColumns,
  });
  expect(result).toBe(IndicatorStatus.Applied);
});

test('getStatus returns Applied when column has value, is not rejected, and appliedColumns is empty set (chart not loaded)', () => {
  const appliedColumns = new Set<string>();
  const rejectedColumns = new Set<string>();
  const result = getStatus({
    label: 'filter value',
    column: 'my_column',
    appliedColumns,
    rejectedColumns,
  });
  expect(result).toBe(IndicatorStatus.Applied);
});
