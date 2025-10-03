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
import { useServerPaginationHandlers } from './index';
import { updateTableOwnState } from '../../../DataTable/utils/externalAPIs';
import { ServerPaginationData, SearchOption } from '../../../types';

jest.mock('../../../DataTable/utils/externalAPIs');

const mockSetDataMask = jest.fn();
const mockUpdateTableOwnState = updateTableOwnState as jest.MockedFunction<
  typeof updateTableOwnState
>;

const mockServerPaginationData: ServerPaginationData = {
  currentPage: 0,
  pageSize: 10,
  sortBy: [],
  searchText: '',
};

const mockSearchOptions: SearchOption[] = [
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

test('handleServerPaginationChange updates state with new page and size', () => {
  const { result } = renderHook(() =>
    useServerPaginationHandlers({
      serverPagination: true,
      serverPaginationData: mockServerPaginationData,
      serverPageLength: 10,
      hasServerPageLengthChanged: false,
      searchOptions: mockSearchOptions,
      setDataMask: mockSetDataMask,
    }),
  );

  act(() => {
    result.current.handleServerPaginationChange(2, 25);
  });

  expect(mockUpdateTableOwnState).toHaveBeenCalledWith(mockSetDataMask, {
    ...mockServerPaginationData,
    currentPage: 2,
    pageSize: 25,
  });
});

test('handleSortByChange updates state with new sort when server pagination is enabled', () => {
  const { result } = renderHook(() =>
    useServerPaginationHandlers({
      serverPagination: true,
      serverPaginationData: mockServerPaginationData,
      serverPageLength: 10,
      hasServerPageLengthChanged: false,
      searchOptions: mockSearchOptions,
      setDataMask: mockSetDataMask,
    }),
  );

  const newSortBy = [{ id: 'name', key: 'name', desc: true }];

  act(() => {
    result.current.handleSortByChange(newSortBy);
  });

  expect(mockUpdateTableOwnState).toHaveBeenCalledWith(mockSetDataMask, {
    ...mockServerPaginationData,
    sortBy: newSortBy,
  });
});

test('handleSortByChange does nothing when server pagination is disabled', () => {
  const { result } = renderHook(() =>
    useServerPaginationHandlers({
      serverPagination: false,
      serverPaginationData: mockServerPaginationData,
      serverPageLength: 10,
      hasServerPageLengthChanged: false,
      searchOptions: mockSearchOptions,
      setDataMask: mockSetDataMask,
    }),
  );

  const newSortBy = [{ id: 'name', key: 'name', desc: true }];

  act(() => {
    result.current.handleSortByChange(newSortBy);
  });

  expect(mockUpdateTableOwnState).not.toHaveBeenCalled();
});

test('debouncedSearch updates state after debounce delay', () => {
  const { result } = renderHook(() =>
    useServerPaginationHandlers({
      serverPagination: true,
      serverPaginationData: mockServerPaginationData,
      serverPageLength: 10,
      hasServerPageLengthChanged: false,
      searchOptions: mockSearchOptions,
      setDataMask: mockSetDataMask,
    }),
  );

  act(() => {
    result.current.debouncedSearch('test search');
  });

  // Should not call immediately
  expect(mockUpdateTableOwnState).not.toHaveBeenCalled();

  // Fast-forward time by 800ms (debounce delay)
  act(() => {
    jest.advanceTimersByTime(800);
  });

  expect(mockUpdateTableOwnState).toHaveBeenCalledWith(mockSetDataMask, {
    ...mockServerPaginationData,
    searchColumn: mockSearchOptions[0].value,
    searchText: 'test search',
    currentPage: 0,
  });
});

test('debouncedSearch uses existing searchColumn if available', () => {
  const dataWithSearchColumn: ServerPaginationData = {
    ...mockServerPaginationData,
    searchColumn: 'email',
  };

  const { result } = renderHook(() =>
    useServerPaginationHandlers({
      serverPagination: true,
      serverPaginationData: dataWithSearchColumn,
      serverPageLength: 10,
      hasServerPageLengthChanged: false,
      searchOptions: mockSearchOptions,
      setDataMask: mockSetDataMask,
    }),
  );

  act(() => {
    result.current.debouncedSearch('test');
    jest.advanceTimersByTime(800);
  });

  expect(mockUpdateTableOwnState).toHaveBeenCalledWith(
    mockSetDataMask,
    expect.objectContaining({
      searchColumn: 'email',
      searchText: 'test',
    }),
  );
});

test('handleChangeSearchCol updates search column and clears search text', () => {
  const { result } = renderHook(() =>
    useServerPaginationHandlers({
      serverPagination: true,
      serverPaginationData: {
        ...mockServerPaginationData,
        searchColumn: 'name',
        searchText: 'old search',
      },
      serverPageLength: 10,
      hasServerPageLengthChanged: false,
      searchOptions: mockSearchOptions,
      setDataMask: mockSetDataMask,
    }),
  );

  act(() => {
    result.current.handleChangeSearchCol('email');
  });

  expect(mockUpdateTableOwnState).toHaveBeenCalledWith(mockSetDataMask, {
    ...mockServerPaginationData,
    searchColumn: 'email',
    searchText: '',
  });
});

test('handleChangeSearchCol does nothing when column is the same', () => {
  const { result } = renderHook(() =>
    useServerPaginationHandlers({
      serverPagination: true,
      serverPaginationData: {
        ...mockServerPaginationData,
        searchColumn: 'name',
      },
      serverPageLength: 10,
      hasServerPageLengthChanged: false,
      searchOptions: mockSearchOptions,
      setDataMask: mockSetDataMask,
    }),
  );

  act(() => {
    result.current.handleChangeSearchCol('name');
  });

  expect(mockUpdateTableOwnState).not.toHaveBeenCalled();
});

test('updates state when server page length changes', () => {
  const { rerender } = renderHook(
    props =>
      useServerPaginationHandlers({
        serverPagination: props.serverPagination,
        serverPaginationData: props.serverPaginationData,
        serverPageLength: props.serverPageLength,
        hasServerPageLengthChanged: props.hasServerPageLengthChanged,
        searchOptions: props.searchOptions,
        setDataMask: props.setDataMask,
      }),
    {
      initialProps: {
        serverPagination: true,
        serverPaginationData: mockServerPaginationData,
        serverPageLength: 10,
        hasServerPageLengthChanged: false,
        searchOptions: mockSearchOptions,
        setDataMask: mockSetDataMask,
      },
    },
  );

  // Trigger page length change
  rerender({
    serverPagination: true,
    serverPaginationData: mockServerPaginationData,
    serverPageLength: 25,
    hasServerPageLengthChanged: true,
    searchOptions: mockSearchOptions,
    setDataMask: mockSetDataMask,
  });

  expect(mockUpdateTableOwnState).toHaveBeenCalledWith(mockSetDataMask, {
    ...mockServerPaginationData,
    currentPage: 0,
    pageSize: 25,
  });
});

test('does not update when hasServerPageLengthChanged is false', () => {
  const { rerender } = renderHook(
    props =>
      useServerPaginationHandlers({
        serverPagination: props.serverPagination,
        serverPaginationData: props.serverPaginationData,
        serverPageLength: props.serverPageLength,
        hasServerPageLengthChanged: props.hasServerPageLengthChanged,
        searchOptions: props.searchOptions,
        setDataMask: props.setDataMask,
      }),
    {
      initialProps: {
        serverPagination: true,
        serverPaginationData: mockServerPaginationData,
        serverPageLength: 10,
        hasServerPageLengthChanged: false,
        searchOptions: mockSearchOptions,
        setDataMask: mockSetDataMask,
      },
    },
  );

  // Change page length but keep hasServerPageLengthChanged false
  rerender({
    serverPagination: true,
    serverPaginationData: mockServerPaginationData,
    serverPageLength: 25,
    hasServerPageLengthChanged: false,
    searchOptions: mockSearchOptions,
    setDataMask: mockSetDataMask,
  });

  expect(mockUpdateTableOwnState).not.toHaveBeenCalled();
});

test('cleans up debounced search on unmount', () => {
  const { result, unmount } = renderHook(() =>
    useServerPaginationHandlers({
      serverPagination: true,
      serverPaginationData: mockServerPaginationData,
      serverPageLength: 10,
      hasServerPageLengthChanged: false,
      searchOptions: mockSearchOptions,
      setDataMask: mockSetDataMask,
    }),
  );

  act(() => {
    result.current.debouncedSearch('test');
  });

  unmount();

  // Advance timers after unmount
  act(() => {
    jest.advanceTimersByTime(800);
  });

  // Should not call updateTableOwnState after unmount
  expect(mockUpdateTableOwnState).not.toHaveBeenCalled();
});

test('memoizes handlers correctly', () => {
  const { result, rerender } = renderHook(
    props => useServerPaginationHandlers(props),
    {
      initialProps: {
        serverPagination: true,
        serverPaginationData: mockServerPaginationData,
        serverPageLength: 10,
        hasServerPageLengthChanged: false,
        searchOptions: mockSearchOptions,
        setDataMask: mockSetDataMask,
      },
    },
  );

  const firstHandlers = result.current;

  rerender({
    serverPagination: true,
    serverPaginationData: mockServerPaginationData,
    serverPageLength: 10,
    hasServerPageLengthChanged: false,
    searchOptions: mockSearchOptions,
    setDataMask: mockSetDataMask,
  });

  const secondHandlers = result.current;

  expect(firstHandlers.handleServerPaginationChange).toBe(
    secondHandlers.handleServerPaginationChange,
  );
  expect(firstHandlers.handleSortByChange).toBe(
    secondHandlers.handleSortByChange,
  );
  expect(firstHandlers.handleChangeSearchCol).toBe(
    secondHandlers.handleChangeSearchCol,
  );
});
