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
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { MenuItem, Pagination } from 'react-bootstrap';

import ListView from 'src/components/ListView/ListView';

describe('ListView', () => {
  const mockedProps = {
    title: 'Data Table',
    columns: [
      {
        accessor: 'id',
        Header: 'ID',
        sortable: true,
      },
      {
        accessor: 'name',
        Header: 'Name',
        filterable: true,
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
    filterTypes: {
      id: [],
      name: [{ name: 'sw', label: 'Starts With' }],
    },
  };
  const wrapper = mount(<ListView {...mockedProps} />);

  afterEach(() => {
    mockedProps.fetchData.mockClear();
  });

  it('calls fetchData on mount', () => {
    expect(wrapper.find(ListView)).toHaveLength(1);
    expect(mockedProps.fetchData.mock.calls[0]).toMatchInlineSnapshot(`
      Array [
        Object {
          "filters": Object {},
          "pageIndex": 0,
          "pageSize": 1,
          "sortBy": Array [],
        },
      ]
    `);
  });

  it('calls fetchData on sort', () => {
    wrapper
      .find('[data-test="sort-header"]')
      .first()
      .simulate('click');
    expect(mockedProps.fetchData.mock.calls[0]).toMatchInlineSnapshot(`
      Array [
        Object {
          "filters": Object {},
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
        .props()
        .onClick();

      wrapper
        .find(MenuItem)
        .props()
        .onSelect({ id: 'name', Header: 'name' });
    });
    wrapper.update();

    act(() => {
      wrapper.find('.filter-inputs input[type="text"]').prop('onChange')({
        currentTarget: { value: 'foo' },
      });
    });
    wrapper.update();

    act(() => {
      wrapper
        .find('[data-test="apply-filters"]')
        .last()
        .prop('onClick')();
    });
    wrapper.update();

    expect(mockedProps.fetchData.mock.calls[0]).toMatchInlineSnapshot(`
      Array [
        Object {
          "filters": Object {
            "name": Object {
              "filterId": "sw",
              "filterValue": "foo",
            },
          },
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

  it('calls fetchData on page change', () => {
    act(() => {
      wrapper.find(Pagination).prop('onSelect')(2);
    });
    wrapper.update();

    expect(mockedProps.fetchData.mock.calls[0]).toMatchInlineSnapshot(`
      Array [
        Object {
          "filters": Object {
            "name": Object {
              "filterId": "sw",
              "filterValue": "foo",
            },
          },
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
});
