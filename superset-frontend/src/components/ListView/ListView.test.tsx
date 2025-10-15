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
import { render, screen, within, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { QueryParamProvider } from 'use-query-params';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import { ReactNode } from 'react';
import { ListView, type ListViewProps } from './ListView';
import { ListViewFilterOperator, type ListViewFetchDataConfig } from './types';

// Test-specific type that properly represents mocked props
type MockedListViewProps = Omit<
  ListViewProps,
  | 'fetchData'
  | 'refreshData'
  | 'addSuccessToast'
  | 'addDangerToast'
  | 'disableBulkSelect'
  | 'bulkActions'
> & {
  fetchData: jest.Mock<unknown[], [ListViewFetchDataConfig]>;
  refreshData: jest.Mock;
  addSuccessToast: jest.Mock;
  addDangerToast: jest.Mock;
  disableBulkSelect: jest.Mock;
  bulkActions: Array<{
    key: string;
    name: ReactNode;
    onSelect: jest.Mock;
    type?: 'primary' | 'secondary' | 'danger';
  }>;
};

const middlewares = [thunk];
const mockStore = configureStore(middlewares);

function makeMockLocation(query?: string) {
  const queryStr = query ? encodeURIComponent(query) : '';
  return {
    protocol: 'http:',
    host: 'localhost',
    pathname: '/',
    search: queryStr.length ? `?${queryStr}` : '',
  } as Location;
}

const fetchSelectsMock = jest.fn(() =>
  Promise.resolve({ data: [], totalCount: 0 }),
);

// Create a properly typed mock with all required fields and Jest mock types
const mockedPropsComprehensive: MockedListViewProps = {
  columns: [
    {
      accessor: 'id',
      Header: 'ID',
      sortable: true,
      id: 'id',
    },
    {
      accessor: 'age',
      Header: 'Age',
      id: 'age',
    },
    {
      accessor: 'name',
      Header: 'Name',
      id: 'name',
    },
    {
      accessor: 'time',
      Header: 'Time',
      id: 'time',
    },
  ],
  filters: [
    {
      key: 'id',
      Header: 'ID',
      id: 'id',
      input: 'select',
      selects: [{ label: 'foo', value: 'bar' }],
      operator: ListViewFilterOperator.Equals,
    },
    {
      key: 'name',
      Header: 'Name',
      id: 'name',
      input: 'search',
      operator: ListViewFilterOperator.Contains,
    },
    {
      key: 'age',
      Header: 'Age',
      id: 'age',
      input: 'select',
      fetchSelects: fetchSelectsMock,
      paginate: true,
      operator: ListViewFilterOperator.Equals,
    },
    {
      key: 'time',
      Header: 'Time',
      id: 'time',
      input: 'datetime_range',
      operator: ListViewFilterOperator.Between,
    },
  ],
  data: [
    { id: 1, name: 'data 1', age: 10, time: '2020-11-18T07:53:45.354Z' },
    { id: 2, name: 'data 2', age: 1, time: '2020-11-18T07:53:45.354Z' },
  ],
  count: 2,
  pageSize: 1,
  fetchData: jest.fn<unknown[], [ListViewFetchDataConfig]>(() => []),
  loading: false,
  refreshData: jest.fn(),
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
  bulkSelectEnabled: true,
  disableBulkSelect: jest.fn(),
  bulkActions: [
    {
      key: 'something',
      name: 'do something',
      type: 'danger',
      onSelect: jest.fn(),
    },
  ],
  cardSortSelectOptions: [
    {
      desc: false,
      id: 'something',
      label: 'Alphabetical',
      value: 'alphabetical',
    },
  ],
};

const mockedPropsSimple = {
  columns: [
    {
      accessor: 'id',
      Header: 'ID',
      sortable: true,
      id: 'id',
    },
    {
      accessor: 'age',
      Header: 'Age',
      id: 'age',
    },
    {
      accessor: 'name',
      Header: 'Name',
      id: 'name',
    },
    {
      accessor: 'time',
      Header: 'Time',
      id: 'time',
    },
  ],
  data: [
    { id: 1, name: 'data 1', age: 10, time: '2020-11-18T07:53:45.354Z' },
    { id: 2, name: 'data 2', age: 1, time: '2020-11-18T07:53:45.354Z' },
  ],
  count: 2,
  pageSize: 1,
  loading: false,
  refreshData: jest.fn(),
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
};

test('redirects to first page when page index is invalid', async () => {
  const fetchData = jest.fn();
  window.history.pushState({}, '', '/?pageIndex=9');
  render(<ListView {...mockedPropsSimple} fetchData={fetchData} />, {
    useRouter: true,
    useQueryParams: true,
  });
  await waitFor(() => {
    expect(window.location.search).toEqual('?pageIndex=0');
    expect(fetchData).toHaveBeenCalledTimes(2);
    expect(fetchData).toHaveBeenCalledWith(
      expect.objectContaining({ pageIndex: 9 }),
    );
    expect(fetchData).toHaveBeenCalledWith(
      expect.objectContaining({ pageIndex: 0 }),
    );
  });
  fetchData.mockClear();
});

// Comprehensive test suite from original JSX file
const factory = (overrides?: Partial<ListViewProps>) => {
  const props = { ...mockedPropsComprehensive, ...overrides };
  return render(
    <QueryParamProvider location={makeMockLocation()}>
      <ListView {...props} />
    </QueryParamProvider>,
    { store: mockStore() },
  );
};

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('ListView', () => {
  beforeEach(() => {
    fetchMock.reset();
    jest.clearAllMocks();
    factory();
  });

  afterEach(() => {
    fetchMock.reset();
    mockedPropsComprehensive.fetchData.mockClear();
    mockedPropsComprehensive.bulkActions.forEach(ba => {
      ba.onSelect.mockClear();
    });
  });

  test('calls fetchData on mount', () => {
    expect(mockedPropsComprehensive.fetchData).toHaveBeenCalledWith({
      filters: [],
      pageIndex: 0,
      pageSize: 1,
      sortBy: [],
    });
  });

  test('calls fetchData on sort', async () => {
    const sortHeader = screen.getAllByTestId('sort-header')[1];
    await userEvent.click(sortHeader);

    expect(mockedPropsComprehensive.fetchData).toHaveBeenCalledWith({
      filters: [],
      pageIndex: 0,
      pageSize: 1,
      sortBy: [
        {
          desc: false,
          id: 'id',
        },
      ],
    });
  });

  test('renders pagination controls', () => {
    const paginationList = screen.getByRole('list');
    expect(paginationList).toBeInTheDocument();

    const pageOneItem = screen.getByRole('listitem', { name: '1' });
    expect(pageOneItem).toBeInTheDocument();
  });

  test('calls fetchData on page change', async () => {
    const pageTwoItem = screen.getByRole('listitem', { name: '2' });
    await userEvent.click(pageTwoItem);

    await waitFor(() => {
      const { calls } = mockedPropsComprehensive.fetchData.mock;
      const pageChangeCall = calls.find(
        (call: [ListViewFetchDataConfig]) =>
          call?.[0]?.pageIndex === 1 &&
          call?.[0]?.filters?.length === 0 &&
          call?.[0]?.pageSize === 1,
      );
      expect(pageChangeCall).toBeDefined();
    });
  });

  test('handles bulk actions on 1 row', async () => {
    const checkboxes = screen.getAllByRole('checkbox');
    await userEvent.click(checkboxes[1]); // Index 1 is the first row checkbox

    const bulkActionButton = within(
      screen.getByTestId('bulk-select-controls'),
    ).getByTestId('bulk-select-action');
    await userEvent.click(bulkActionButton);

    expect(
      mockedPropsComprehensive.bulkActions[0].onSelect,
    ).toHaveBeenCalledWith([
      {
        age: 10,
        id: 1,
        name: 'data 1',
        time: '2020-11-18T07:53:45.354Z',
      },
    ]);
  });

  test('renders UI filters', () => {
    const filterControls = screen.getAllByRole('combobox');
    expect(filterControls).toHaveLength(2);
  });

  test('calls fetchData on filter', async () => {
    // Handle select filter
    const selectFilter = screen.getAllByRole('combobox')[0];
    await userEvent.click(selectFilter);
    const option = screen.getByText('foo');
    await userEvent.click(option);

    // Handle search filter
    const searchFilter = screen.getByPlaceholderText('Type a value');
    await userEvent.type(searchFilter, 'something');
    await userEvent.tab();

    expect(mockedPropsComprehensive.fetchData).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [
          {
            id: 'id',
            operator: 'eq',
            value: { label: 'foo', value: 'bar' },
          },
          {
            id: 'name',
            operator: 'ct',
            value: 'something',
          },
        ],
      }),
    );
  });

  test('calls fetchData on card view sort', async () => {
    factory({
      renderCard: jest.fn(),
      initialSort: [{ id: 'something' }],
    });

    const sortSelect = screen.getByTestId('card-sort-select');
    await userEvent.click(sortSelect);

    const sortOption = screen.getByText('Alphabetical');
    await userEvent.click(sortOption);

    expect(mockedPropsComprehensive.fetchData).toHaveBeenCalled();
  });
});
