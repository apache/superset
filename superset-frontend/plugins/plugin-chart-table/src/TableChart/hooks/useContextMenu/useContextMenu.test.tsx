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
import { renderHook } from '@testing-library/react-hooks';
import { DataRecord } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/api/core';
import { useContextMenu } from './index';
import { DataColumnMeta } from '../../../types';

const mockGetCrossFilterDataMask = jest.fn((key, value) => ({
  extraFormData: {},
  filterState: {},
}));

const mockOnContextMenu = jest.fn();

const mockFilteredColumnsMeta: DataColumnMeta[] = [
  {
    key: 'name',
    label: 'Name',
    dataType: GenericDataType.String,
    isMetric: false,
    config: {},
  },
  {
    key: 'age',
    label: 'Age',
    dataType: GenericDataType.Numeric,
    isMetric: false,
    config: {},
  },
  {
    key: 'score',
    label: 'Score',
    dataType: GenericDataType.Numeric,
    isMetric: true,
    config: {},
  },
];

const mockRowData: DataRecord = {
  name: 'John Doe',
  age: 30,
  score: 95,
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('returns undefined when onContextMenu is not provided', () => {
  const { result } = renderHook(() =>
    useContextMenu({
      onContextMenu: undefined,
      isRawRecords: false,
      filteredColumnsMeta: mockFilteredColumnsMeta,
      getCrossFilterDataMask: mockGetCrossFilterDataMask,
    }),
  );

  expect(result.current).toBeUndefined();
});

test('returns undefined when isRawRecords is true', () => {
  const { result } = renderHook(() =>
    useContextMenu({
      onContextMenu: mockOnContextMenu,
      isRawRecords: true,
      filteredColumnsMeta: mockFilteredColumnsMeta,
      getCrossFilterDataMask: mockGetCrossFilterDataMask,
    }),
  );

  expect(result.current).toBeUndefined();
});

test('returns context menu handler when conditions are met', () => {
  const { result } = renderHook(() =>
    useContextMenu({
      onContextMenu: mockOnContextMenu,
      isRawRecords: false,
      filteredColumnsMeta: mockFilteredColumnsMeta,
      getCrossFilterDataMask: mockGetCrossFilterDataMask,
    }),
  );

  expect(result.current).toBeDefined();
  expect(typeof result.current).toBe('function');
});

test('handler creates drill-to-detail filters for non-metric columns', () => {
  const { result } = renderHook(() =>
    useContextMenu({
      onContextMenu: mockOnContextMenu,
      isRawRecords: false,
      filteredColumnsMeta: mockFilteredColumnsMeta,
      getCrossFilterDataMask: mockGetCrossFilterDataMask,
    }),
  );

  const handler = result.current;
  handler?.(
    mockRowData,
    { key: 'name', value: 'John Doe', isMetric: false },
    100,
    200,
  );

  expect(mockOnContextMenu).toHaveBeenCalledWith(100, 200, {
    drillToDetail: [
      {
        col: 'name',
        op: '==',
        val: 'John Doe',
        formattedVal: 'John Doe',
      },
      {
        col: 'age',
        op: '==',
        val: 30,
        formattedVal: '30',
      },
    ],
    crossFilter: expect.any(Object),
    drillBy: {
      filters: [
        {
          col: 'name',
          op: '==',
          val: 'John Doe',
        },
      ],
      groupbyFieldName: 'groupby',
    },
  });
});

test('handler excludes cross-filter and drill-by for metric columns', () => {
  const { result } = renderHook(() =>
    useContextMenu({
      onContextMenu: mockOnContextMenu,
      isRawRecords: false,
      filteredColumnsMeta: mockFilteredColumnsMeta,
      getCrossFilterDataMask: mockGetCrossFilterDataMask,
    }),
  );

  const handler = result.current;
  handler?.(mockRowData, { key: 'score', value: 95, isMetric: true }, 100, 200);

  expect(mockOnContextMenu).toHaveBeenCalledWith(100, 200, {
    drillToDetail: expect.any(Array),
    crossFilter: undefined,
    drillBy: undefined,
  });
});

test('handler calls getCrossFilterDataMask for non-metric columns', () => {
  const { result } = renderHook(() =>
    useContextMenu({
      onContextMenu: mockOnContextMenu,
      isRawRecords: false,
      filteredColumnsMeta: mockFilteredColumnsMeta,
      getCrossFilterDataMask: mockGetCrossFilterDataMask,
    }),
  );

  const handler = result.current;
  handler?.(mockRowData, { key: 'age', value: 30, isMetric: false }, 100, 200);

  expect(mockGetCrossFilterDataMask).toHaveBeenCalledWith('age', 30);
});

test('memoizes handler when dependencies do not change', () => {
  const { result, rerender } = renderHook(props => useContextMenu(props), {
    initialProps: {
      onContextMenu: mockOnContextMenu,
      isRawRecords: false,
      filteredColumnsMeta: mockFilteredColumnsMeta,
      getCrossFilterDataMask: mockGetCrossFilterDataMask,
    },
  });

  const firstHandler = result.current;

  rerender({
    onContextMenu: mockOnContextMenu,
    isRawRecords: false,
    filteredColumnsMeta: mockFilteredColumnsMeta,
    getCrossFilterDataMask: mockGetCrossFilterDataMask,
  });

  const secondHandler = result.current;

  expect(firstHandler).toBe(secondHandler);
});

test('recreates handler when onContextMenu changes', () => {
  const { result, rerender } = renderHook(props => useContextMenu(props), {
    initialProps: {
      onContextMenu: mockOnContextMenu,
      isRawRecords: false,
      filteredColumnsMeta: mockFilteredColumnsMeta,
      getCrossFilterDataMask: mockGetCrossFilterDataMask,
    },
  });

  const firstHandler = result.current;

  const newOnContextMenu = jest.fn();
  rerender({
    onContextMenu: newOnContextMenu,
    isRawRecords: false,
    filteredColumnsMeta: mockFilteredColumnsMeta,
    getCrossFilterDataMask: mockGetCrossFilterDataMask,
  });

  const secondHandler = result.current;

  expect(firstHandler).not.toBe(secondHandler);
});

test('does not recreate handler when filteredColumnsMeta changes (uses ref)', () => {
  const { result, rerender } = renderHook(props => useContextMenu(props), {
    initialProps: {
      onContextMenu: mockOnContextMenu,
      isRawRecords: false,
      filteredColumnsMeta: mockFilteredColumnsMeta,
      getCrossFilterDataMask: mockGetCrossFilterDataMask,
    },
  });

  const firstHandler = result.current;

  const newColumnsMeta = [
    ...mockFilteredColumnsMeta,
    {
      key: 'newCol',
      label: 'New Column',
      dataType: GenericDataType.String,
      isMetric: false,
      config: {},
    },
  ];

  rerender({
    onContextMenu: mockOnContextMenu,
    isRawRecords: false,
    filteredColumnsMeta: newColumnsMeta,
    getCrossFilterDataMask: mockGetCrossFilterDataMask,
  });

  const secondHandler = result.current;

  // Handler should be same reference (performance optimization via ref)
  expect(firstHandler).toBe(secondHandler);

  // But should use updated columns when called
  secondHandler?.(
    { ...mockRowData, newCol: 'test' },
    { key: 'name', value: 'John Doe', isMetric: false },
    100,
    200,
  );

  // Should include the new column in drillToDetail
  expect(mockOnContextMenu).toHaveBeenCalledWith(
    100,
    200,
    expect.objectContaining({
      drillToDetail: expect.arrayContaining([
        expect.objectContaining({ col: 'newCol' }),
      ]),
    }),
  );
});
