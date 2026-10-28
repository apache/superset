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
import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter, useHistory } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import rison from 'rison';
import { ListViewFilterOperator, type ListViewFilter } from './types';
import { useListViewState } from './utils';

const initialFilters: ListViewFilter[] = [
  {
    key: 'name',
    id: 'name',
    Header: 'Name',
    input: 'search',
    operator: ListViewFilterOperator.Contains,
  },
];
const columns = [
  { id: 'name', accessor: 'name' as const, Header: 'Name' },
  { id: 'age', accessor: 'age' as const, Header: 'Age' },
];
const data = [{ name: 'example', age: 15 }];
const initialSort = [{ id: 'name', desc: false }];

function renderListState(
  initialEntries = ['/?type=dashboard&pageIndex=2'],
  filters = initialFilters,
) {
  const fetchData = jest.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter
      initialEntries={initialEntries}
      initialIndex={initialEntries.length - 1}
    >
      <QueryParamProvider adapter={ReactRouter5Adapter}>
        {children}
      </QueryParamProvider>
    </MemoryRouter>
  );
  const hook = renderHook(
    () => ({
      ...useListViewState({
        columns,
        data,
        count: 100,
        initialPageSize: 10,
        initialFilters: filters,
        initialSort,
        fetchData,
      }),
      history: useHistory(),
    }),
    { wrapper },
  );
  return { ...hook, fetchData };
}

test('Back and Forward restore filters and results after filtering on a later page', async () => {
  const { result, fetchData } = renderListState();
  await waitFor(() => expect(result.current.state.pageIndex).toBe(2));
  act(() => result.current.applyFilterValue(0, 'saved'));
  await waitFor(() => {
    expect(result.current.state.pageIndex).toBe(0);
    expect(fetchData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pageIndex: 0,
        filters: [
          {
            id: 'name',
            value: 'saved',
            operator: ListViewFilterOperator.Contains,
          },
        ],
      }),
    );
    expect(
      new URLSearchParams(result.current.history.location.search).get('type'),
    ).toBe('dashboard');
  });
  act(() => result.current.history.goBack());
  await waitFor(() => {
    expect(result.current.state.pageIndex).toBe(2);
    expect(result.current.state.internalFilters[0].value).toBeUndefined();
    expect(result.current.state.filters).toEqual([]);
    expect(fetchData).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageIndex: 2, filters: [] }),
    );
    expect(
      new URLSearchParams(result.current.history.location.search).get(
        'filters',
      ),
    ).toBeNull();
  });
  act(() => result.current.history.goForward());
  await waitFor(() => {
    expect(result.current.state.pageIndex).toBe(0);
    expect(result.current.state.internalFilters[0].value).toBe('saved');
    expect(fetchData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pageIndex: 0,
        filters: [
          {
            id: 'name',
            value: 'saved',
            operator: ListViewFilterOperator.Contains,
          },
        ],
      }),
    );
    const encoded = new URLSearchParams(
      result.current.history.location.search,
    ).get('filters');
    expect(rison.decode(encoded || '')).toEqual({ name: 'saved' });
  });
});

test('same-page history restores aliased and range filters in controls and requests', async () => {
  const filters: ListViewFilter[] = [
    { ...initialFilters[0], urlDisplay: 'title' },
    {
      key: 'age',
      id: 'age',
      Header: 'Age',
      input: 'datetime_range',
      operator: ListViewFilterOperator.Between,
    },
  ];
  const oldFilters = { title: 'old', age: [10, 20] };
  const newFilters = { title: 'new' };
  const { result, fetchData } = renderListState(
    [
      `/?type=dataset&pageIndex=0&filters=${rison.encode(oldFilters)}`,
      `/?type=dataset&pageIndex=0&filters=${rison.encode(newFilters)}`,
    ],
    filters,
  );
  await waitFor(() =>
    expect(result.current.state.internalFilters[0].value).toBe('new'),
  );
  act(() => result.current.history.goBack());
  await waitFor(() => {
    expect(
      result.current.state.internalFilters.map(filter => filter.value),
    ).toEqual(['old', [10, 20]]);
    expect(fetchData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pageIndex: 0,
        filters: [
          {
            id: 'name',
            value: 'old',
            operator: ListViewFilterOperator.Contains,
          },
          { id: 'age', value: 10, operator: 'gt' },
          { id: 'age', value: 20, operator: 'lt' },
        ],
      }),
    );
    expect(
      new URLSearchParams(result.current.history.location.search).get('type'),
    ).toBe('dataset');
  });
  act(() => result.current.history.goForward());
  await waitFor(() => {
    expect(
      result.current.state.internalFilters.map(filter => filter.value),
    ).toEqual(['new', undefined]);
    expect(fetchData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pageIndex: 0,
        filters: [
          {
            id: 'name',
            value: 'new',
            operator: ListViewFilterOperator.Contains,
          },
        ],
      }),
    );
  });
});
