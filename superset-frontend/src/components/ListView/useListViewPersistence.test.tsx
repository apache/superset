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
import { ReactNode } from 'react';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import { Router } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import useListViewPersistence, {
  type ListViewPersistenceConfig,
} from './useListViewPersistence';
import { useListViewState } from './utils';
import { ListViewFilterOperator } from './types';

const resources = ['dashboard', 'chart', 'dataset'] as const;
const savedQuery = new URLSearchParams({
  filters: '(name:needle)',
  pageIndex: '3',
  sortColumn: 'name',
  sortOrder: 'desc',
  viewMode: 'table',
}).toString();

/** Mount a list route independently, as menu navigation does. */
function mountList(
  resource: ListViewPersistenceConfig['resource'] = 'dashboard',
  search = '',
  userId = 7,
) {
  const history = createMemoryHistory({
    initialEntries: [`/${resource}/list/${search}`],
  });
  const hook = renderHook(() => useListViewPersistence({ resource, userId }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <Router history={history}>{children}</Router>
    ),
  });
  return { ...hook, history };
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test.each(resources)(
  'restores all %s settings after leaving and returning through a bare link',
  resource => {
    const original = mountList(resource, `?${savedQuery}`);
    original.unmount();
    const other = mountList(
      resource === 'chart' ? 'dataset' : 'chart',
      '?pageIndex=1',
    );
    other.unmount();
    const restored = mountList(resource);
    expect(
      new URLSearchParams(restored.history.location.search).toString(),
    ).toBe(savedQuery);
    expect(restored.result.current.restoring).toBe(false);
  },
);

test('explicit URL settings replace saved state rather than inheriting omitted filters', () => {
  mountList('dashboard', `?${savedQuery}`).unmount();
  const linked = mountList('dashboard', '?sortColumn=name&sortOrder=asc');
  expect(linked.history.location.search).toBe('?sortColumn=name&sortOrder=asc');
  expect(
    new URLSearchParams(linked.history.location.search).has('filters'),
  ).toBe(false);
  linked.unmount();
  const restored = mountList();
  expect(new URLSearchParams(restored.history.location.search).toString()).toBe(
    'sortColumn=name&sortOrder=asc',
  );
});

test('keeps unrelated link parameters but never remembers them as list state', () => {
  mountList('dashboard', `?${savedQuery}&unrelated=old`).unmount();
  const restored = mountList('dashboard', '?unrelated=new');
  const query = new URLSearchParams(restored.history.location.search);
  expect(query.get('unrelated')).toBe('new');
  expect(query.get('pageIndex')).toBe('3');
  const saved = JSON.parse(sessionStorage.getItem('listview__state:7') || '{}');
  expect(new URLSearchParams(saved.dashboard).has('unrelated')).toBe(false);
});

test('does not restore another user or another list state', () => {
  mountList('dashboard', `?${savedQuery}`).unmount();
  const otherUser = mountList('dashboard', '', 8);
  expect(otherUser.history.location.search).toBe('');
  otherUser.unmount();
  const otherList = mountList('dataset');
  expect(otherList.history.location.search).toBe('');
});

test('preserves encoded search text and selected filter values without re-encoding them', () => {
  const filters = "(name:'R&D + 50% # 数据',owners:!((label:Alice,value:7)))";
  const search = `?${new URLSearchParams({ filters, pageIndex: '0' })}`;
  mountList('dataset', search).unmount();
  const returned = mountList('dataset');
  expect(
    new URLSearchParams(returned.history.location.search).get('filters'),
  ).toBe(filters);
});

test.each(['()', '!n'])(
  'empty filter expressions do not enable Clear all: %s',
  filters => {
    const current = mountList('chart', `?${new URLSearchParams({ filters })}`);
    expect(current.result.current.hasSavedFilters).toBe(false);
  },
);

test('Clear all removes saved filters across lists while preserving sort, view, and other users', () => {
  resources.forEach(resource =>
    mountList(resource, `?${savedQuery}`).unmount(),
  );
  mountList('dashboard', `?${savedQuery}`, 8).unmount();
  const current = mountList(
    'chart',
    '?sortColumn=name&sortOrder=asc&viewMode=card&pageIndex=0',
  );
  // The current list is unfiltered; other lists still make Clear all useful.
  expect(current.result.current.hasSavedFilters).toBe(true);
  act(() => current.result.current.clearSavedFilters());
  expect(current.result.current.hasSavedFilters).toBe(false);
  current.unmount();
  resources.forEach(resource => {
    const returned = mountList(resource);
    const query = new URLSearchParams(returned.history.location.search);
    expect(query.has('filters')).toBe(false);
    expect(query.get('pageIndex')).toBe('0');
    expect(query.get('sortColumn')).toBe('name');
    expect(query.get('viewMode')).toBe(resource === 'chart' ? 'card' : 'table');
    returned.unmount();
  });
  const otherUser = mountList('dashboard', '', 8);
  expect(
    new URLSearchParams(otherUser.history.location.search).get('filters'),
  ).toBe('(name:needle)');
});

test('clearing a list remains cleared after navigating away and back', () => {
  const current = mountList('dashboard', `?${savedQuery}`);
  act(() => {
    current.result.current.clearSavedFilters();
    current.history.replace(
      '?pageIndex=0&sortColumn=name&sortOrder=desc&viewMode=table',
    );
  });
  current.unmount();
  const returned = mountList();
  expect(
    new URLSearchParams(returned.history.location.search).has('filters'),
  ).toBe(false);
});

test('keeps Back and Forward URL settings authoritative without adding restore history entries', () => {
  mountList('dashboard', `?${savedQuery}`).unmount();
  const current = mountList();
  expect(current.history.length).toBe(1);
  act(() => current.history.push('?pageIndex=5'));
  act(() => current.history.goBack());
  expect(new URLSearchParams(current.history.location.search).toString()).toBe(
    savedQuery,
  );
  act(() => current.history.goForward());
  expect(current.history.location.search).toBe('?pageIndex=5');
});

test.each([
  'not json',
  'null',
  '[]',
  '{"dashboard":9}',
  '{"dashboard":"pageIndex=-1"}',
  '{"dashboard":"viewMode=invalid"}',
])('ignores damaged saved state: %s', stored => {
  sessionStorage.setItem('listview__state:7', stored);
  const current = mountList();
  expect(current.history.location.search).toBe('');
});

test('continues to work when session storage is unavailable', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  const current = mountList('dashboard', '?pageIndex=2');
  expect(current.history.location.search).toBe('?pageIndex=2');
  expect(() =>
    act(() => current.result.current.clearSavedFilters()),
  ).not.toThrow();
});

test('the first data request uses restored filters, sort, and pagination', async () => {
  mountList('dashboard', `?${savedQuery}`).unmount();
  const history = createMemoryHistory({ initialEntries: ['/dashboard/list/'] });
  const fetchData = jest.fn();
  const columns = [{ id: 'name', accessor: 'name' as const }];
  const filters = [
    {
      id: 'name',
      key: 'name',
      Header: 'Name',
      operator: ListViewFilterOperator.Contains,
    },
  ];
  const initialSort = [{ id: 'name', desc: false }];
  const data = [{ name: 'needle' }];
  function Table() {
    useListViewState({
      columns,
      initialFilters: filters,
      initialSort,
      data,
      count: 100,
      initialPageSize: 10,
      fetchData,
      renderCard: true,
    });
    return null;
  }
  function Gate() {
    const { restoring } = useListViewPersistence({
      userId: 7,
      resource: 'dashboard',
    });
    return restoring ? null : <Table />;
  }
  render(
    <Router history={history}>
      <QueryParamProvider adapter={ReactRouter5Adapter}>
        <Gate />
      </QueryParamProvider>
    </Router>,
  );
  await waitFor(() => expect(fetchData).toHaveBeenCalled());
  expect(fetchData.mock.calls[0][0]).toEqual({
    pageIndex: 3,
    pageSize: 10,
    sortBy: [{ id: 'name', desc: true }],
    filters: [
      {
        id: 'name',
        value: 'needle',
        operator: ListViewFilterOperator.Contains,
      },
    ],
  });
  expect(new URLSearchParams(history.location.search).get('viewMode')).toBe(
    'table',
  );
});

test('changing view mode persists without fetching the same data again', async () => {
  const history = createMemoryHistory({ initialEntries: ['/chart/list/'] });
  const fetchData = jest.fn();
  const options = {
    columns: [{ id: 'name', accessor: 'name' as const }],
    initialSort: [{ id: 'name', desc: false }],
    data: [{ name: 'chart' }],
    count: 1,
    initialPageSize: 10,
    fetchData,
    renderCard: true,
  };
  const current = renderHook(
    () => {
      useListViewPersistence({ userId: 7, resource: 'chart' });
      return useListViewState(options);
    },
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <Router history={history}>
          <QueryParamProvider adapter={ReactRouter5Adapter}>
            {children}
          </QueryParamProvider>
        </Router>
      ),
    },
  );
  await waitFor(() =>
    expect(new URLSearchParams(history.location.search).get('viewMode')).toBe(
      'card',
    ),
  );
  const requests = fetchData.mock.calls.length;
  act(() => current.result.current.setViewMode('table'));
  await waitFor(() =>
    expect(new URLSearchParams(history.location.search).get('viewMode')).toBe(
      'table',
    ),
  );
  expect(fetchData).toHaveBeenCalledTimes(requests);
  current.unmount();
  const returned = mountList('chart');
  expect(
    new URLSearchParams(returned.history.location.search).get('viewMode'),
  ).toBe('table');
});

test('Back and Forward synchronize table pagination without adding history entries', async () => {
  const history = createMemoryHistory({
    initialEntries: ['/chart/list/?pageIndex=0'],
  });
  const options = {
    columns: [{ id: 'name', accessor: 'name' as const }],
    initialSort: [{ id: 'name', desc: false }],
    data: [{ name: 'chart' }],
    count: 100,
    initialPageSize: 10,
    fetchData: jest.fn(),
  };
  const current = renderHook(() => useListViewState(options), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <Router history={history}>
        <QueryParamProvider adapter={ReactRouter5Adapter}>
          {children}
        </QueryParamProvider>
      </Router>
    ),
  });
  act(() => current.result.current.gotoPage(3));
  await waitFor(() =>
    expect(new URLSearchParams(history.location.search).get('pageIndex')).toBe(
      '3',
    ),
  );
  act(() => current.result.current.gotoPage(5));
  await waitFor(() =>
    expect(new URLSearchParams(history.location.search).get('pageIndex')).toBe(
      '5',
    ),
  );
  expect(history.length).toBe(3);
  act(() => history.goBack());
  await waitFor(() => expect(current.result.current.state.pageIndex).toBe(3));
  expect(new URLSearchParams(history.location.search).get('pageIndex')).toBe(
    '3',
  );
  expect(history.length).toBe(3);
  act(() => history.goForward());
  await waitFor(() => expect(current.result.current.state.pageIndex).toBe(5));
  expect(new URLSearchParams(history.location.search).get('pageIndex')).toBe(
    '5',
  );
  expect(history.length).toBe(3);
});
