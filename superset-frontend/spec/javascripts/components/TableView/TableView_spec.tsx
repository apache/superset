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
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import Pagination from 'src/components/Pagination';
import TableView from '../../../../src/components/TableView';
import { TableViewProps } from '../../../../src/components/TableView/TableView';

const mockedProps: TableViewProps = {
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
  data: [
    { id: 1, age: 20, name: 'Emily' },
    { id: 2, age: 10, name: 'Kate' },
    { id: 3, age: 40, name: 'Anna' },
    { id: 4, age: 30, name: 'Jane' },
  ],
  pageSize: 1,
};

const factory = (props = mockedProps) =>
  mount(<TableView {...props} />, {
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: { theme: supersetTheme },
  });

describe('TableView', () => {
  it('render a table, columns and rows', () => {
    const pageSize = 10;
    const wrapper = factory({ ...mockedProps, pageSize });
    expect(wrapper.find('table')).toExist();
    expect(wrapper.find('table th')).toHaveLength(mockedProps.columns.length);
    expect(wrapper.find('table tbody tr')).toHaveLength(
      Math.min(mockedProps.data.length, pageSize),
    );
  });

  it('renders pagination controls', () => {
    const wrapper = factory();
    expect(wrapper.find(Pagination)).toExist();
    expect(wrapper.find(Pagination.Prev)).toExist();
    expect(wrapper.find(Pagination.Item)).toExist();
    expect(wrapper.find(Pagination.Next)).toExist();
  });

  it("doesn't render pagination when pagination is disabled", () => {
    const wrapper = factory({ ...mockedProps, withPagination: false });
    expect(wrapper.find(Pagination)).not.toExist();
  });

  it("doesn't render pagination when fewer rows than page size", () => {
    const pageSize = 999;
    expect(pageSize).toBeGreaterThan(mockedProps.data.length);

    const wrapper = factory({ ...mockedProps, pageSize });
    expect(wrapper.find(Pagination)).not.toExist();
  });

  it('changes page when button is clicked', () => {
    const pageSize = 3;
    const dataLength = mockedProps.data.length;

    expect(dataLength).toBeGreaterThan(pageSize);
    const wrapper = factory({ ...mockedProps, pageSize });

    expect(wrapper.find('table tbody tr')).toHaveLength(pageSize);

    wrapper.find('NEXT_PAGE_LINK span').simulate('click');
    expect(wrapper.find('table tbody tr')).toHaveLength(
      Math.min(dataLength - pageSize, pageSize),
    );
  });

  it('sorts by age when header cell is clicked', () => {
    const wrapper = factory();
    expect(wrapper.find('table tbody td Cell').at(1).props().value).toEqual(20);

    // sort ascending
    wrapper.find('table thead th').at(1).simulate('click');
    expect(wrapper.find('table tbody td Cell').at(1).props().value).toEqual(10);

    // sort descending
    wrapper.find('table thead th').at(1).simulate('click');
    expect(wrapper.find('table tbody td Cell').at(1).props().value).toEqual(40);

    // no sort
    wrapper.find('table thead th').at(1).simulate('click');
    expect(wrapper.find('table tbody td Cell').at(1).props().value).toEqual(20);
  });

  it('sorts by data when initialSortBy is passed', () => {
    let wrapper = factory();
    expect(wrapper.find('table tbody td Cell').at(2).props().value).toEqual(
      'Emily',
    );

    wrapper = factory({
      ...mockedProps,
      initialSortBy: [{ id: 'name', desc: true }],
    });
    expect(wrapper.find('table tbody td Cell').at(2).props().value).toEqual(
      'Kate',
    );

    wrapper = factory({
      ...mockedProps,
      initialSortBy: [{ id: 'name', desc: false }],
    });
    expect(wrapper.find('table tbody td Cell').at(2).props().value).toEqual(
      'Anna',
    );
  });
});
