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

// Only import components that are directly referenced in tests
import { ListView } from './ListView';

jest.mock('@superset-ui/core/components', () => ({
  Alert: ({ children, message, ...props }) => (
    <div {...props}>{message || children}</div>
  ),
  DropdownButton: ({ children, onClick, 'data-test': dataTest, ...props }) => (
    <button type="button" onClick={onClick} data-test={dataTest} {...props}>
      {children}
    </button>
  ),
  Icons: {
    AppstoreOutlined: props => (
      <span {...props} role="img" aria-label="appstore" />
    ),
    UnorderedListOutlined: props => (
      <span {...props} role="img" aria-label="unordered-list" />
    ),
    DeleteOutlined: props => <span {...props} role="img" aria-label="delete" />,
  },
  EmptyState: ({ children, ...props }) => <div {...props}>{children}</div>,
  Checkbox: props => <input type="checkbox" {...props} />,
  Loading: () => <div>Loading...</div>,
  Flex: ({ children, ...props }) => <div {...props}>{children}</div>,
  Menu: {
    Item: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
  Modal: ({ children, ...props }) => <div {...props}>{children}</div>,
  Select: ({ children, onChange, onSelect, value, ...props }) => (
    <select
      role="combobox"
      value={value}
      onChange={e => {
        if (onChange) onChange(e.target.value);
        if (onSelect) onSelect(e.target.value);
      }}
      {...props}
    >
      {children}
    </select>
  ),
  Pagination: props => <div {...props}>Pagination</div>,
  TableCollection: props => <div {...props}>TableCollection</div>,
  AsyncEsmComponent:
    () =>
    ({ children, ...props }) => <div {...props}>{children}</div>,
}));

jest.mock('./Filters', () => {
  // eslint-disable-next-line global-require
  const React = require('react');
  return React.forwardRef((props, ref) =>
    React.createElement(
      'div',
      { ref, ...props },
      React.createElement(
        'select',
        {
          role: 'combobox',
          onChange: () =>
            props.updateFilterValue?.(0, { label: 'foo', value: 'bar' }),
        },
        React.createElement(
          'option',
          {
            value: 'bar',
            onClick: () =>
              props.updateFilterValue?.(0, { label: 'foo', value: 'bar' }),
          },
          'foo',
        ),
      ),
      React.createElement(
        'select',
        {
          role: 'combobox',
          onChange: () =>
            props.updateFilterValue?.(2, {
              label: 'age_option',
              value: 'age_value',
            }),
        },
        React.createElement('option', { value: 'age_value' }, 'age_option'),
      ),
      React.createElement('input', {
        placeholder: 'Type a value',
        onBlur: e => {
          if (e.target.value) props.updateFilterValue?.(1, e.target.value);
        },
      }),
    ),
  );
});

jest.mock('./CardCollection', () => props => <div {...props} />);

jest.mock('./CardSortSelect', () => ({
  CardSortSelect: props => (
    <select
      data-test="card-sort-select"
      role="combobox"
      onChange={props.onChange}
      {...props}
    >
      <option value="alphabetical">Alphabetical</option>
    </select>
  ),
}));

jest.mock('src/features/tags/BulkTagModal', () => props => <div {...props} />);

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

  // Update pagination control tests for Ant Design pagination
  it('renders pagination controls', () => {
    const paginationList = screen.getByRole('list');
    expect(paginationList).toBeInTheDocument();

    const pageOneItem = screen.getByRole('listitem', { name: '1' });
    expect(pageOneItem).toBeInTheDocument();
  });

  it('calls fetchData on page change', async () => {
    const pageTwoItem = screen.getByRole('listitem', { name: '2' });
    await userEvent.click(pageTwoItem);

    await waitFor(() => {
      const { calls } = mockedProps.fetchData.mock;
      const pageChangeCall = calls.find(
        call =>
          call[0].pageIndex === 1 &&
          call[0].filters.length === 0 &&
          call[0].pageSize === 1,
      );
      expect(pageChangeCall).toBeDefined();
    });
  });

  it('handles bulk actions on 1 row', async () => {
    const checkboxes = screen.getAllByRole('checkbox');
    await userEvent.click(checkboxes[1]); // Index 1 is the first row checkbox

    // Verify bulk select controls are visible
    expect(screen.getByTestId('bulk-select-controls')).toBeInTheDocument();

    const bulkActionButton = within(
      screen.getByTestId('bulk-select-controls'),
    ).getByTestId('bulk-select-action');

    // Verify the button exists and is clickable
    expect(bulkActionButton).toBeInTheDocument();

    // Click the bulk action button
    await userEvent.click(bulkActionButton);

    // Wait for the async handleBulkActionClick to complete and mock to be called
    await waitFor(
      () => {
        expect(mockedProps.bulkActions[0].onSelect).toHaveBeenCalledWith([
          {
            age: 10,
            id: 1,
            name: 'data 1',
            time: '2020-11-18T07:53:45.354Z',
          },
        ]);
      },
      { timeout: 2000 },
    );
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
