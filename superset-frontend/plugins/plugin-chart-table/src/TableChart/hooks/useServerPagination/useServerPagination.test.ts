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
import { useServerPagination } from './index';
import * as externalAPIs from '../../../DataTable/utils/externalAPIs';

jest.mock('../../../DataTable/utils/externalAPIs');

const mockUpdateTableOwnState = externalAPIs.updateTableOwnState as jest.Mock;

beforeEach(() => {
  mockUpdateTableOwnState.mockClear();
});

const mockServerPaginationData = {
  currentPage: 0,
  pageSize: 10,
  sortBy: [],
  searchColumn: 'name',
  searchText: '',
};

test('provides handleServerPaginationChange callback', () => {
  const setDataMask = jest.fn();
  const { result } = renderHook(() =>
    useServerPagination({
      serverPaginationData: mockServerPaginationData,
      setDataMask,
      serverPagination: true,
    }),
  );

  expect(typeof result.current.handleServerPaginationChange).toBe('function');
});

test('provides handleSortByChange callback', () => {
  const setDataMask = jest.fn();
  const { result } = renderHook(() =>
    useServerPagination({
      serverPaginationData: mockServerPaginationData,
      setDataMask,
      serverPagination: true,
    }),
  );

  expect(typeof result.current.handleSortByChange).toBe('function');
});

test('provides handleSearchColChange callback', () => {
  const setDataMask = jest.fn();
  const { result } = renderHook(() =>
    useServerPagination({
      serverPaginationData: mockServerPaginationData,
      setDataMask,
      serverPagination: true,
    }),
  );

  expect(typeof result.current.handleSearchColChange).toBe('function');
});

test('provides handleSearch callback', () => {
  const setDataMask = jest.fn();
  const { result } = renderHook(() =>
    useServerPagination({
      serverPaginationData: mockServerPaginationData,
      setDataMask,
      serverPagination: true,
    }),
  );

  expect(typeof result.current.handleSearch).toBe('function');
});

test('handleServerPaginationChange updates pagination state', () => {
  const setDataMask = jest.fn();
  const { result } = renderHook(() =>
    useServerPagination({
      serverPaginationData: mockServerPaginationData,
      setDataMask,
      serverPagination: true,
    }),
  );

  result.current.handleServerPaginationChange(2, 20);

  expect(mockUpdateTableOwnState).toHaveBeenCalledWith(setDataMask, {
    ...mockServerPaginationData,
    currentPage: 2,
    pageSize: 20,
  });
});

test('handleSortByChange updates sort state when serverPagination is true', () => {
  const setDataMask = jest.fn();
  const { result } = renderHook(() =>
    useServerPagination({
      serverPaginationData: mockServerPaginationData,
      setDataMask,
      serverPagination: true,
    }),
  );

  const sortBy = [{ id: 'name', key: 'name', desc: false }];
  result.current.handleSortByChange(sortBy);

  expect(mockUpdateTableOwnState).toHaveBeenCalledWith(setDataMask, {
    ...mockServerPaginationData,
    sortBy,
  });
});

test('handleSortByChange does nothing when serverPagination is false', () => {
  const setDataMask = jest.fn();
  const { result } = renderHook(() =>
    useServerPagination({
      serverPaginationData: mockServerPaginationData,
      setDataMask,
      serverPagination: false,
    }),
  );

  const sortBy = [{ id: 'name', key: 'name', desc: false }];
  result.current.handleSortByChange(sortBy);

  expect(mockUpdateTableOwnState).not.toHaveBeenCalled();
});

test('handleSearchColChange updates search column and clears search text', () => {
  const setDataMask = jest.fn();
  const { result } = renderHook(() =>
    useServerPagination({
      serverPaginationData: mockServerPaginationData,
      setDataMask,
      serverPagination: true,
    }),
  );

  result.current.handleSearchColChange('email');

  expect(mockUpdateTableOwnState).toHaveBeenCalledWith(
    setDataMask,
    expect.objectContaining({
      searchColumn: 'email',
      searchText: '',
    }),
  );
});

test('handleSearch updates search text and resets to first page', () => {
  const setDataMask = jest.fn();
  const { result } = renderHook(() =>
    useServerPagination({
      serverPaginationData: mockServerPaginationData,
      setDataMask,
      serverPagination: true,
    }),
  );

  result.current.handleSearch('john', []);

  expect(mockUpdateTableOwnState).toHaveBeenCalledWith(
    setDataMask,
    expect.objectContaining({
      searchText: 'john',
      currentPage: 0,
    }),
  );
});

test('handleSearch uses existing search column when available', () => {
  const setDataMask = jest.fn();
  const { result } = renderHook(() =>
    useServerPagination({
      serverPaginationData: {
        ...mockServerPaginationData,
        searchColumn: 'email',
      },
      setDataMask,
      serverPagination: true,
    }),
  );

  result.current.handleSearch('test', []);

  expect(mockUpdateTableOwnState).toHaveBeenCalledWith(
    setDataMask,
    expect.objectContaining({
      searchColumn: 'email',
      searchText: 'test',
    }),
  );
});

test('handleSearch uses first search option when no search column exists', () => {
  const setDataMask = jest.fn();
  const { result } = renderHook(() =>
    useServerPagination({
      serverPaginationData: { currentPage: 0, pageSize: 10 },
      setDataMask,
      serverPagination: true,
    }),
  );

  result.current.handleSearch('test', [
    { value: 'name', label: 'Name' },
    { value: 'email', label: 'Email' },
  ]);

  expect(mockUpdateTableOwnState).toHaveBeenCalledWith(
    setDataMask,
    expect.objectContaining({
      searchColumn: 'name',
      searchText: 'test',
    }),
  );
});
