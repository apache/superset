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
import { createWrapper } from 'spec/helpers/testing-library';
import { useProTableState, UseProTableStateConfig } from './useProTableState';

const mockFetchData = jest.fn();

const createConfig = (
  overrides: Partial<UseProTableStateConfig<{ id: number; name: string }>> = {},
): UseProTableStateConfig<{ id: number; name: string }> => ({
  fetchData: mockFetchData,
  data: [
    { id: 1, name: 'Test 1' },
    { id: 2, name: 'Test 2' },
  ],
  count: 10,
  initialPageSize: 5,
  initialSort: [{ id: 'name', desc: false }],
  initialFilters: [],
  renderCard: false,
  defaultViewMode: 'table',
  ...overrides,
});

beforeEach(() => {
  mockFetchData.mockClear();
});

test('initializes with correct default values', () => {
  const { result } = renderHook(() => useProTableState(createConfig()), {
    wrapper: createWrapper(),
  });

  expect(result.current.pageIndex).toBe(0);
  expect(result.current.pageSize).toBe(5);
  expect(result.current.pageCount).toBe(2);
  expect(result.current.sortBy).toEqual([{ id: 'name', desc: false }]);
  expect(result.current.viewMode).toBe('table');
  expect(result.current.selectedRowKeys).toEqual([]);
});

test('calls fetchData on mount with initial values', () => {
  renderHook(() => useProTableState(createConfig()), {
    wrapper: createWrapper(),
  });

  expect(mockFetchData).toHaveBeenCalledWith({
    pageIndex: 0,
    pageSize: 5,
    sortBy: [{ id: 'name', desc: false }],
    filters: [],
  });
});

test('gotoPage updates pageIndex', () => {
  const { result } = renderHook(() => useProTableState(createConfig()), {
    wrapper: createWrapper(),
  });

  act(() => {
    result.current.gotoPage(1);
  });

  expect(result.current.pageIndex).toBe(1);
});

test('setSortBy updates sorting', () => {
  const { result } = renderHook(() => useProTableState(createConfig()), {
    wrapper: createWrapper(),
  });

  act(() => {
    result.current.setSortBy([{ id: 'id', desc: true }]);
  });

  expect(result.current.sortBy).toEqual([{ id: 'id', desc: true }]);
});

test('setViewMode updates view mode for card-enabled views', () => {
  const { result } = renderHook(
    () => useProTableState(createConfig({ renderCard: true })),
    { wrapper: createWrapper() },
  );

  act(() => {
    result.current.setViewMode('card');
  });

  expect(result.current.viewMode).toBe('card');
});

test('selection state works correctly with row.id', () => {
  const { result } = renderHook(() => useProTableState(createConfig()), {
    wrapper: createWrapper(),
  });

  // Select using row.id values (1, 2) from the test data
  act(() => {
    result.current.setSelectedRowKeys(['1', '2']);
  });

  expect(result.current.selectedRowKeys).toEqual(['1', '2']);
  expect(result.current.selectedRows).toHaveLength(2);
});

test('toggleAllRowsSelected selects all rows using row.id', () => {
  const { result } = renderHook(() => useProTableState(createConfig()), {
    wrapper: createWrapper(),
  });

  act(() => {
    result.current.toggleAllRowsSelected(true);
  });

  // Uses row.id (1, 2) instead of array index (0, 1)
  expect(result.current.selectedRowKeys).toEqual(['1', '2']);
});

test('toggleAllRowsSelected deselects all rows', () => {
  const { result } = renderHook(() => useProTableState(createConfig()), {
    wrapper: createWrapper(),
  });

  act(() => {
    result.current.toggleAllRowsSelected(true);
  });

  act(() => {
    result.current.toggleAllRowsSelected(false);
  });

  expect(result.current.selectedRowKeys).toEqual([]);
});

test('pageCount is calculated correctly', () => {
  const { result } = renderHook(
    () => useProTableState(createConfig({ count: 23, initialPageSize: 10 })),
    { wrapper: createWrapper() },
  );

  expect(result.current.pageCount).toBe(3);
});

test('defaults to card view when renderCard is true and defaultViewMode is card', () => {
  const { result } = renderHook(
    () =>
      useProTableState(
        createConfig({ renderCard: true, defaultViewMode: 'card' }),
      ),
    { wrapper: createWrapper() },
  );

  expect(result.current.viewMode).toBe('card');
});

test('defaults to table view when renderCard is false', () => {
  const { result } = renderHook(
    () => useProTableState(createConfig({ renderCard: false })),
    { wrapper: createWrapper() },
  );

  expect(result.current.viewMode).toBe('table');
});
