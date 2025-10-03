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
import { renderHook, act } from '@testing-library/react-hooks';
import { GenericDataType } from '@apache-superset/core/api/core';
import { useTimeComparison } from './index';
import { DataColumnMeta } from '../../../types';

const mockColumnsMeta: DataColumnMeta[] = [
  {
    key: 'revenue',
    label: 'Current',
    dataType: GenericDataType.Numeric,
  },
  {
    key: 'revenue__previous_year',
    label: 'Previous year',
    dataType: GenericDataType.Numeric,
  },
  {
    key: 'revenue__previous_month',
    label: 'Previous month',
    dataType: GenericDataType.Numeric,
  },
];

const mockComparisonLabels = ['Current', 'Previous year', 'Previous month'];
const mockComparisonColumns = [
  { key: '__timestamp', label: 'Display all' },
  { key: 'Previous year', label: 'Previous year' },
  { key: 'Previous month', label: 'Previous month' },
];

test('initializes with default state', () => {
  const { result } = renderHook(() =>
    useTimeComparison({
      columnsMeta: mockColumnsMeta,
      isUsingTimeComparison: true,
      comparisonLabels: mockComparisonLabels,
      comparisonColumns: mockComparisonColumns,
    }),
  );

  expect(result.current.showComparisonDropdown).toBe(false);
  expect(result.current.selectedComparisonColumns).toEqual(['__timestamp']);
  expect(result.current.hideComparisonKeys).toEqual([]);
});

test('returns all columns when isUsingTimeComparison is false', () => {
  const { result } = renderHook(() =>
    useTimeComparison({
      columnsMeta: mockColumnsMeta,
      isUsingTimeComparison: false,
      comparisonLabels: mockComparisonLabels,
      comparisonColumns: mockComparisonColumns,
    }),
  );

  expect(result.current.filteredColumnsMeta).toEqual(mockColumnsMeta);
});

test('returns all columns when Display all is selected', () => {
  const { result } = renderHook(() =>
    useTimeComparison({
      columnsMeta: mockColumnsMeta,
      isUsingTimeComparison: true,
      comparisonLabels: mockComparisonLabels,
      comparisonColumns: mockComparisonColumns,
    }),
  );

  expect(result.current.filteredColumnsMeta).toEqual(mockColumnsMeta);
});

test('filters columns when specific comparison is selected', () => {
  const { result } = renderHook(() =>
    useTimeComparison({
      columnsMeta: mockColumnsMeta,
      isUsingTimeComparison: true,
      comparisonLabels: mockComparisonLabels,
      comparisonColumns: mockComparisonColumns,
    }),
  );

  act(() => {
    result.current.setSelectedComparisonColumns(['Previous year']);
  });

  expect(result.current.filteredColumnsMeta).toHaveLength(2);
  expect(
    result.current.filteredColumnsMeta.some(col => col.label === 'Current'),
  ).toBe(true);
  expect(
    result.current.filteredColumnsMeta.some(
      col => col.label === 'Previous year',
    ),
  ).toBe(true);
  expect(
    result.current.filteredColumnsMeta.some(
      col => col.label === 'Previous month',
    ),
  ).toBe(false);
});

test('allows changing showComparisonDropdown state', () => {
  const { result } = renderHook(() =>
    useTimeComparison({
      columnsMeta: mockColumnsMeta,
      isUsingTimeComparison: true,
      comparisonLabels: mockComparisonLabels,
      comparisonColumns: mockComparisonColumns,
    }),
  );

  expect(result.current.showComparisonDropdown).toBe(false);

  act(() => {
    result.current.setShowComparisonDropdown(true);
  });

  expect(result.current.showComparisonDropdown).toBe(true);
});

test('allows changing selectedComparisonColumns state', () => {
  const { result } = renderHook(() =>
    useTimeComparison({
      columnsMeta: mockColumnsMeta,
      isUsingTimeComparison: true,
      comparisonLabels: mockComparisonLabels,
      comparisonColumns: mockComparisonColumns,
    }),
  );

  expect(result.current.selectedComparisonColumns).toEqual(['__timestamp']);

  act(() => {
    result.current.setSelectedComparisonColumns(['Previous year']);
  });

  expect(result.current.selectedComparisonColumns).toEqual(['Previous year']);
});

test('hideComparisonKeys state can be updated', () => {
  const { result } = renderHook(() =>
    useTimeComparison({
      columnsMeta: mockColumnsMeta,
      isUsingTimeComparison: true,
      comparisonLabels: mockComparisonLabels,
      comparisonColumns: mockComparisonColumns,
    }),
  );

  act(() => {
    result.current.setHideComparisonKeys(['__previous_year']);
  });

  expect(result.current.hideComparisonKeys).toEqual(['__previous_year']);
});

test('always includes current column in filtered results', () => {
  const { result } = renderHook(() =>
    useTimeComparison({
      columnsMeta: mockColumnsMeta,
      isUsingTimeComparison: true,
      comparisonLabels: mockComparisonLabels,
      comparisonColumns: mockComparisonColumns,
    }),
  );

  act(() => {
    result.current.setSelectedComparisonColumns(['Previous year']);
  });

  const currentColumn = result.current.filteredColumnsMeta.find(
    col => col.label === 'Current',
  );
  expect(currentColumn).toBeDefined();
});

test('supports multiple selected comparison columns', () => {
  const { result } = renderHook(() =>
    useTimeComparison({
      columnsMeta: mockColumnsMeta,
      isUsingTimeComparison: true,
      comparisonLabels: mockComparisonLabels,
      comparisonColumns: mockComparisonColumns,
    }),
  );

  act(() => {
    result.current.setSelectedComparisonColumns([
      'Previous year',
      'Previous month',
    ]);
  });

  expect(result.current.filteredColumnsMeta).toHaveLength(3);
  expect(
    result.current.filteredColumnsMeta.some(col => col.label === 'Current'),
  ).toBe(true);
  expect(
    result.current.filteredColumnsMeta.some(
      col => col.label === 'Previous year',
    ),
  ).toBe(true);
  expect(
    result.current.filteredColumnsMeta.some(
      col => col.label === 'Previous month',
    ),
  ).toBe(true);
});
