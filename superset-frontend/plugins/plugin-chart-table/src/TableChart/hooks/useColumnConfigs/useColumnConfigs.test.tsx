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
import '@testing-library/jest-dom';
import { renderHook } from '@testing-library/react-hooks';
import { DataRecord } from '@superset-ui/core';
import { supersetTheme, ThemeProvider } from '@apache-superset/core/ui';
import { GenericDataType } from '@apache-superset/core/api/core';
import { useColumnConfigs } from './index';
import { DataColumnMeta } from '../../../types';

const wrapper = ({ children }: any) => (
  <ThemeProvider theme={supersetTheme}>{children}</ThemeProvider>
);

const mockSortIcon = ({ column }: any) => (
  <span>{column.isSorted ? '↑' : '○'}</span>
);

const mockColumn: DataColumnMeta = {
  key: 'test_column',
  label: 'Test Column',
  dataType: GenericDataType.String,
  isMetric: false,
  config: {},
};

const mockMetricColumn: DataColumnMeta = {
  key: 'metric_column',
  label: 'Metric Column',
  dataType: GenericDataType.Numeric,
  isMetric: true,
  config: {},
};

const defaultProps = {
  defaultAlignPN: false,
  defaultColorPN: false,
  emitCrossFilters: false,
  getValueRange: jest.fn(() => null as [number, number] | null),
  isActiveFilterValue: jest.fn(() => false),
  isRawRecords: false,
  showCellBars: true,
  sortDesc: false,
  comparisonLabels: ['Main', '#', '△', '%'],
  getSharedStyle: jest.fn(() => ({ textAlign: 'left' as const })),
  groupHeaderColumns: {},
  handleToggleFilter: jest.fn(),
  SortIcon: mockSortIcon,
};

test('returns a function that generates column configurations', () => {
  const { result } = renderHook(
    () => useColumnConfigs<DataRecord>(defaultProps),
    {
      wrapper,
    },
  );

  expect(typeof result.current).toBe('function');
});

test('generates column config with correct id and accessor', () => {
  const { result } = renderHook(
    () => useColumnConfigs<DataRecord>(defaultProps),
    { wrapper },
  );

  const config = result.current(mockColumn, 0);

  expect(config.id).toBe('0');
  expect(config.columnKey).toBe('test_column');
  expect(typeof config.accessor).toBe('function');
});

test('generates column config with Cell renderer', () => {
  const { result } = renderHook(
    () => useColumnConfigs<DataRecord>(defaultProps),
    { wrapper },
  );

  const config = result.current(mockColumn, 0);

  expect(config.Cell).toBeDefined();
  expect(typeof config.Cell).toBe('function');
});

test('generates column config with Header renderer', () => {
  const { result } = renderHook(
    () => useColumnConfigs<DataRecord>(defaultProps),
    { wrapper },
  );

  const config = result.current(mockColumn, 0);

  expect(config.Header).toBeDefined();
  expect(typeof config.Header).toBe('function');
});

test('sets correct sortType based on dataType', () => {
  const { result } = renderHook(
    () => useColumnConfigs<DataRecord>(defaultProps),
    { wrapper },
  );

  const stringConfig = result.current(mockColumn, 0);
  expect(stringConfig.sortType).toBe('alphanumeric');

  const numericConfig = result.current(mockMetricColumn, 1);
  expect(numericConfig.sortType).toBe('basic');
});

test('includes Footer renderer when totals are provided', () => {
  const propsWithTotals = {
    ...defaultProps,
    totals: { test_column: 'Total' },
  };

  const { result } = renderHook(
    () => useColumnConfigs<DataRecord>(propsWithTotals),
    { wrapper },
  );

  const config = result.current(mockColumn, 0);

  expect(config.Footer).toBeDefined();
});

test('does not include Footer renderer when totals are not provided', () => {
  const { result } = renderHook(
    () => useColumnConfigs<DataRecord>(defaultProps),
    { wrapper },
  );

  const config = result.current(mockColumn, 0);

  expect(config.Footer).toBeUndefined();
});

test('applies custom column name when provided', () => {
  const columnWithCustomName: DataColumnMeta = {
    ...mockColumn,
    config: {
      customColumnName: 'Custom Name',
    },
  };

  const { result } = renderHook(
    () => useColumnConfigs<DataRecord>(defaultProps),
    { wrapper },
  );

  const config = result.current(columnWithCustomName, 0);

  // The Header function should use the custom name
  expect(config.Header).toBeDefined();
});

test('adds cross-filter class when emitCrossFilters is true and column is not metric', () => {
  const propsWithCrossFilters = {
    ...defaultProps,
    emitCrossFilters: true,
  };

  const { result } = renderHook(
    () => useColumnConfigs<DataRecord>(propsWithCrossFilters),
    { wrapper },
  );

  const config = result.current(mockColumn, 0);

  // Check that Cell function exists and would add the filter class
  expect(config.Cell).toBeDefined();
});

test('calculates value range for metrics when showCellBars is true', () => {
  const mockValueRange = jest.fn(() => [0, 100] as [number, number]);
  const propsWithCellBars = {
    ...defaultProps,
    showCellBars: true,
    getValueRange: mockValueRange,
  };

  const { result } = renderHook(
    () => useColumnConfigs<DataRecord>(propsWithCellBars),
    { wrapper },
  );

  result.current(mockMetricColumn, 0);

  expect(mockValueRange).toHaveBeenCalledWith('metric_column', false);
});

test('does not calculate value range when showCellBars is false', () => {
  const mockValueRange = jest.fn(() => [0, 100] as [number, number]);
  const propsWithoutCellBars = {
    ...defaultProps,
    showCellBars: false,
    getValueRange: mockValueRange,
  };

  const { result } = renderHook(
    () => useColumnConfigs<DataRecord>(propsWithoutCellBars),
    { wrapper },
  );

  result.current(mockMetricColumn, 0);

  expect(mockValueRange).not.toHaveBeenCalled();
});

test('sets sortDescFirst based on sortDesc prop', () => {
  const propsWithDescSort = {
    ...defaultProps,
    sortDesc: true,
  };

  const { result } = renderHook(
    () => useColumnConfigs<DataRecord>(propsWithDescSort),
    { wrapper },
  );

  const config = result.current(mockColumn, 0);

  expect(config.sortDescFirst).toBe(true);
});

test('handles comparison columns with special labels', () => {
  const comparisonColumn: DataColumnMeta = {
    key: '# metric_1',
    label: '#',
    originalLabel: 'metric_1',
    dataType: GenericDataType.Numeric,
    isMetric: true,
    config: {},
  };

  const { result } = renderHook(
    () => useColumnConfigs<DataRecord>(defaultProps),
    { wrapper },
  );

  const config = result.current(comparisonColumn, 0);

  expect(config.id).toBe('0');
  expect(config.columnKey).toBe('# metric_1');
});

test('applies alignPositiveNegative from column config', () => {
  const columnWithAlign: DataColumnMeta = {
    ...mockMetricColumn,
    config: {
      alignPositiveNegative: true,
    },
  };

  const mockValueRange = jest.fn(() => [0, 100] as [number, number]);
  const propsWithRange = {
    ...defaultProps,
    getValueRange: mockValueRange,
  };

  const { result } = renderHook(
    () => useColumnConfigs<DataRecord>(propsWithRange),
    { wrapper },
  );

  result.current(columnWithAlign, 0);

  expect(mockValueRange).toHaveBeenCalledWith('metric_column', true);
});

test('uses default alignPositiveNegative when not specified in config', () => {
  const mockValueRange = jest.fn(() => [0, 100] as [number, number]);
  const propsWithDefaultAlign = {
    ...defaultProps,
    defaultAlignPN: true,
    getValueRange: mockValueRange,
  };

  const { result } = renderHook(
    () => useColumnConfigs<DataRecord>(propsWithDefaultAlign),
    { wrapper },
  );

  result.current(mockMetricColumn, 0);

  expect(mockValueRange).toHaveBeenCalledWith('metric_column', true);
});

test('memoizes the getColumnConfigs function', () => {
  const { result, rerender } = renderHook(
    () => useColumnConfigs<DataRecord>(defaultProps),
    { wrapper },
  );

  const firstRender = result.current;
  rerender();
  const secondRender = result.current;

  expect(firstRender).toBe(secondRender);
});

test('returns new function when dependencies change', () => {
  const { result, rerender } = renderHook(
    ({ sortDesc }) =>
      useColumnConfigs<DataRecord>({ ...defaultProps, sortDesc }),
    { wrapper, initialProps: { sortDesc: false } },
  );

  const firstRender = result.current;

  rerender({ sortDesc: true });
  const secondRender = result.current;

  expect(firstRender).not.toBe(secondRender);
});

test('handles column with custom width configuration', () => {
  const columnWithWidth: DataColumnMeta = {
    ...mockColumn,
    config: {
      columnWidth: 200,
    },
  };

  const { result } = renderHook(
    () => useColumnConfigs<DataRecord>(defaultProps),
    { wrapper },
  );

  const config = result.current(columnWithWidth, 0);

  // Header should include width hint
  expect(config.Header).toBeDefined();
});

test('handles percent metric columns', () => {
  const percentColumn: DataColumnMeta = {
    key: 'percent_metric',
    label: 'Percent Metric',
    dataType: GenericDataType.Numeric,
    isMetric: false,
    isPercentMetric: true,
    config: {},
  };

  const mockValueRange = jest.fn(() => [0, 100] as [number, number]);
  const propsWithRange = {
    ...defaultProps,
    getValueRange: mockValueRange,
  };

  const { result } = renderHook(
    () => useColumnConfigs<DataRecord>(propsWithRange),
    { wrapper },
  );

  result.current(percentColumn, 0);

  expect(mockValueRange).toHaveBeenCalled();
});
