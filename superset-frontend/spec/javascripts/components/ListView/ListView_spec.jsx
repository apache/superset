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
import React from 'react';
import { mount, shallow } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { MenuItem, Pagination } from 'react-bootstrap';
import Select from 'react-select';
import { QueryParamProvider } from 'use-query-params';

import ListView from 'src/components/ListView/ListView';
import ListViewFilters from 'src/components/ListView/Filters';
import ListViewPagination from 'src/components/ListView/Pagination';
import { areArraysShallowEqual } from 'src/reduxUtils';
import { ThemeProvider } from 'emotion-theming';
import { supersetTheme } from '@superset-ui/style';

export function makeMockLocation(query) {
  const queryStr = encodeURIComponent(query);
  return {
    protocol: 'http:',
    host: 'localhost',
    pathname: '/',
    search: queryStr.length ? `?${queryStr}` : '',
  };
}

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
  ],
  filters: [
    {
      Header: 'Name',
      id: 'name',
      operators: [{ label: 'Starts With', value: 'sw' }],
    },
  ],
  data: [
    { id: 1, name: 'data 1' },
    { id: 2, name: 'data 2' },
  ],
  count: 2,
  pageSize: 1,
  fetchData: jest.fn(() => []),
  loading: false,
  bulkActions: [{ name: 'do something', onSelect: jest.fn() }],
};

const factory = (props = mockedProps) =>
  mount(
    <QueryParamProvider location={makeMockLocation()}>
      <ListView {...props} />
    </QueryParamProvider>,
    {
      wrappingComponent: ThemeProvider,
      wrappingComponentProps: { theme: supersetTheme },
    },
  );

describe('ListView', () => {
  const wrapper = factory();

  afterEach(() => {
    mockedProps.fetchData.mockClear();
    mockedProps.bulkActions.forEach(ba => {
      ba.onSelect.mockClear();
    });
  });

  it('calls fetchData on mount', () => {
    expect(wrapper.find(ListView)).toHaveLength(1);
    expect(mockedProps.fetchData.mock.calls[0]).toMatchInlineSnapshot(`
                                                      Array [
                                                        Object {
                                                          "filters": Array [],
                                                          "pageIndex": 0,
                                                          "pageSize": 1,
                                                          "sortBy": Array [],
                                                        },
                                                      ]
                                    `);
  });

  it('calls fetchData on sort', () => {
    wrapper.find('[data-test="sort-header"]').at(1).simulate('click');

    expect(mockedProps.fetchData).toHaveBeenCalled();
    expect(mockedProps.fetchData.mock.calls[0]).toMatchInlineSnapshot(`
                                                      Array [
                                                        Object {
                                                          "filters": Array [],
                                                          "pageIndex": 0,
                                                          "pageSize": 1,
                                                          "sortBy": Array [
                                                            Object {
                                                              "desc": false,
                                                              "id": "id",
                                                            },
                                                          ],
                                                        },
                                                      ]
                                    `);
  });

  it('calls fetchData on filter', () => {
    act(() => {
      wrapper
        .find('.dropdown-toggle')
        .children('button')
        .at(0)
        .props()
        .onClick();

      wrapper
        .find(MenuItem)
        .at(0)
        .props()
        .onSelect({ id: 'name', Header: 'name' });
    });
    wrapper.update();

    act(() => {
      wrapper.find('.filter-inputs input[type="text"]').prop('onChange')({
        persist() {},
        currentTarget: { value: 'foo' },
      });
    });
    wrapper.update();

    act(() => {
      wrapper.find('[data-test="apply-filters"]').last().prop('onClick')();
    });
    wrapper.update();

    expect(mockedProps.fetchData.mock.calls[0]).toMatchInlineSnapshot(`
Array [
  Object {
    "filters": Array [
      Object {
        "id": "name",
        "operator": "sw",
        "value": "foo",
      },
    ],
    "pageIndex": 0,
    "pageSize": 1,
    "sortBy": Array [
      Object {
        "desc": false,
        "id": "id",
      },
    ],
  },
]
`);
  });

  it('renders pagination controls', () => {
    expect(wrapper.find(Pagination).exists()).toBe(true);
    expect(wrapper.find(Pagination.Prev).exists()).toBe(true);
    expect(wrapper.find(Pagination.Item).exists()).toBe(true);
    expect(wrapper.find(Pagination.Next).exists()).toBe(true);
  });

  it('calls fetchData on page change', () => {
    act(() => {
      wrapper.find(ListViewPagination).prop('onChange')(2);
    });
    wrapper.update();

    expect(mockedProps.fetchData.mock.calls[0]).toMatchInlineSnapshot(`
Array [
  Object {
    "filters": Array [
      Object {
        "id": "name",
        "operator": "sw",
        "value": "foo",
      },
    ],
    "pageIndex": 1,
    "pageSize": 1,
    "sortBy": Array [
      Object {
        "desc": false,
        "id": "id",
      },
    ],
  },
]
`);
  });

  it('handles bulk actions on 1 row', () => {
    act(() => {
      wrapper
        .find('input[title="Toggle Row Selected"]')
        .at(0)
        .prop('onChange')({ target: { value: 'on' } });

      wrapper
        .find('.dropdown-toggle')
        .children('button')
        .at(1)
        .props()
        .onClick();
    });
    wrapper.update();
    const bulkActionsProps = wrapper.find(MenuItem).last().props();

    bulkActionsProps.onSelect(bulkActionsProps.eventKey);
    expect(mockedProps.bulkActions[0].onSelect.mock.calls[0])
      .toMatchInlineSnapshot(`
                                    Array [
                                      Array [
                                        Object {
                                          "id": 1,
                                          "name": "data 1",
                                        },
                                      ],
                                    ]
                        `);
  });

  it('handles bulk actions on all rows', () => {
    act(() => {
      wrapper
        .find('input[title="Toggle All Rows Selected"]')
        .at(0)
        .prop('onChange')({ target: { value: 'on' } });

      wrapper
        .find('.dropdown-toggle')
        .children('button')
        .at(1)
        .props()
        .onClick();
    });
    wrapper.update();
    const bulkActionsProps = wrapper.find(MenuItem).last().props();

    bulkActionsProps.onSelect(bulkActionsProps.eventKey);
    expect(mockedProps.bulkActions[0].onSelect.mock.calls[0])
      .toMatchInlineSnapshot(`
                        Array [
                          Array [
                            Object {
                              "id": 1,
                              "name": "data 1",
                            },
                            Object {
                              "id": 2,
                              "name": "data 2",
                            },
                          ],
                        ]
                `);
  });

  it('Throws an exception if filter missing in columns', () => {
    expect.assertions(1);
    const props = {
      ...mockedProps,
      filters: [...mockedProps.filters, { id: 'some_column' }],
    };
    try {
      shallow(<ListView {...props} />, {
        wrappingComponent: ThemeProvider,
        wrappingComponentProps: { theme: supersetTheme },
      });
    } catch (e) {
      expect(e).toMatchInlineSnapshot(
        `[ListViewError: Invalid filter config, some_column is not present in columns]`,
      );
    }
  });
});

describe('ListView with new UI filters', () => {
  const fetchSelectsMock = jest.fn(() => []);
  const newFiltersProps = {
    ...mockedProps,
    useNewUIFilters: true,
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
        operator: 'eq',
      },
    ],
  };

  const wrapper = factory(newFiltersProps);

  afterEach(() => {
    mockedProps.fetchData.mockClear();
    mockedProps.bulkActions.forEach(ba => {
      ba.onSelect.mockClear();
    });
  });

  it('renders UI filters', () => {
    expect(wrapper.find(ListViewFilters)).toHaveLength(1);
  });

  it('fetched selects if function is provided', () => {
    expect(fetchSelectsMock).toHaveBeenCalled();
  });

  it('calls fetchData on filter', () => {
    act(() => {
      wrapper
        .find('[data-test="filters-select"]')
        .first()
        .props()
        .onChange({ value: 'bar' });
    });

    act(() => {
      wrapper
        .find('[data-test="filters-search"]')
        .first()
        .props()
        .onChange({ currentTarget: { value: 'something' } });
    });

    wrapper.update();

    act(() => {
      wrapper.find('[data-test="search-input"]').last().props().onBlur();
    });

    expect(newFiltersProps.fetchData.mock.calls[0]).toMatchInlineSnapshot(`
Array [
  Object {
    "filters": Array [
      Object {
        "id": "id",
        "operator": "eq",
        "value": "bar",
      },
    ],
    "pageIndex": 0,
    "pageSize": 1,
    "sortBy": Array [],
  },
]
`);

    expect(newFiltersProps.fetchData.mock.calls[1]).toMatchInlineSnapshot(`
Array [
  Object {
    "filters": Array [
      Object {
        "id": "id",
        "operator": "eq",
        "value": "bar",
      },
      Object {
        "id": "name",
        "operator": "ct",
        "value": "something",
      },
    ],
    "pageIndex": 0,
    "pageSize": 1,
    "sortBy": Array [],
  },
]
`);
  });
});
