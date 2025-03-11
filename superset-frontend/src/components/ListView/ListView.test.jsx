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
import { render, screen, within } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { QueryParamProvider } from 'use-query-params';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';

// Only import components that are directly referenced in tests
import ListView from 'src/components/ListView/ListView';

const middlewares = [thunk];
const mockStore = configureStore(middlewares);

function makeMockLocation(query) {
  const queryStr = encodeURIComponent(query);
  return {
    protocol: 'http:',
    host: 'localhost',
    pathname: '/',
    search: queryStr.length ? `?${queryStr}` : '',
  };
}

const fetchSelectsMock = jest.fn(() => []);
const mockedProps = {
  title: 'Data Table',
  columns: [
    {
      accessor: 'id',
      Header: 'ID',
      sortable: true,
    },
    {
      accessor: 'age',
      Header: 'Age',
    },
    {
      accessor: 'name',
      Header: 'Name',
    },
    {
      accessor: 'time',
      Header: 'Time',
    },
  ],
  filters: [
    {
      Header: 'ID',
      id: 'id',
      input: 'select',
      selects: [{ label: 'foo', value: 'bar' }],
      operator: 'eq',
    },
    {
      Header: 'Name',
      id: 'name',
      input: 'search',
      operator: 'ct',
    },
    {
      Header: 'Age',
      id: 'age',
      input: 'select',
      fetchSelects: fetchSelectsMock,
      paginate: true,
      operator: 'eq',
    },
    {
      Header: 'Time',
      id: 'time',
      input: 'datetime_range',
      operator: 'between',
    },
  ],
  data: [
    { id: 1, name: 'data 1', age: 10, time: '2020-11-18T07:53:45.354Z' },
    { id: 2, name: 'data 2', age: 1, time: '2020-11-18T07:53:45.354Z' },
  ],
  count: 2,
  pageSize: 1,
  fetchData: jest.fn(() => []),
  loading: false,
  bulkSelectEnabled: true,
  disableBulkSelect: jest.fn(),
  bulkActions: [
    {
      key: 'something',
      name: 'do something',
      style: 'danger',
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

const factory = (props = mockedProps) =>
  render(
    <QueryParamProvider location={makeMockLocation()}>
      <ListView {...props} />
    </QueryParamProvider>,
    { store: mockStore() },
  );

describe('ListView', () => {
  beforeEach(() => {
    fetchMock.reset();
    jest.clearAllMocks();
    factory();
  });

  afterEach(() => {
    fetchMock.reset();
    mockedProps.fetchData.mockClear();
    mockedProps.bulkActions.forEach(ba => {
      ba.onSelect.mockClear();
    });
  });

  // Example of converted test:
  it('calls fetchData on mount', () => {
    expect(mockedProps.fetchData).toHaveBeenCalledWith({
      filters: [],
      pageIndex: 0,
      pageSize: 1,
      sortBy: [],
    });
  });

  it('calls fetchData on sort', async () => {
    const sortHeader = screen.getAllByTestId('sort-header')[1];
    await userEvent.click(sortHeader);

    expect(mockedProps.fetchData).toHaveBeenCalledWith({
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

  // Update pagination control tests to use button role
  it('renders pagination controls', () => {
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '«' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '»' })).toBeInTheDocument();
  });

  it('calls fetchData on page change', async () => {
    const nextButton = screen.getByRole('button', { name: '»' });
    await userEvent.click(nextButton);

    // Remove sortBy expectation since it's not part of the initial state
    expect(mockedProps.fetchData).toHaveBeenCalledWith({
      filters: [],
      pageIndex: 1,
      pageSize: 1,
      sortBy: [],
    });
  });

  it('handles bulk actions on 1 row', async () => {
    const checkboxes = screen.getAllByRole('checkbox', { name: '' });
    await userEvent.click(checkboxes[1]); // Index 1 is the first row checkbox

    const bulkActionButton = within(
      screen.getByTestId('bulk-select-controls'),
    ).getByTestId('bulk-select-action');
    await userEvent.click(bulkActionButton);

    expect(mockedProps.bulkActions[0].onSelect).toHaveBeenCalledWith([
      {
        age: 10,
        id: 1,
        name: 'data 1',
        time: '2020-11-18T07:53:45.354Z',
      },
    ]);
  });

  // Update UI filters test to use more specific selector
  it('renders UI filters', () => {
    const filterControls = screen.getAllByRole('combobox');
    expect(filterControls).toHaveLength(2);
  });

  it('calls fetchData on filter', async () => {
    // Handle select filter
    const selectFilter = screen.getAllByRole('combobox')[0];
    await userEvent.click(selectFilter);
    const option = screen.getByText('foo');
    await userEvent.click(option);

    // Handle search filter
    const searchFilter = screen.getByPlaceholderText('Type a value');
    await userEvent.type(searchFilter, 'something');
    await userEvent.tab();

    expect(mockedProps.fetchData).toHaveBeenCalledWith(
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

  it('calls fetchData on card view sort', async () => {
    factory({
      ...mockedProps,
      renderCard: jest.fn(),
      initialSort: [{ id: 'something' }],
    });

    const sortSelect = screen.getByTestId('card-sort-select');
    await userEvent.click(sortSelect);

    const sortOption = screen.getByText('Alphabetical');
    await userEvent.click(sortOption);

    expect(mockedProps.fetchData).toHaveBeenCalled();
  });
});
