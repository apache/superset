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
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';

import Link from 'src/components/Link';
import TableElement from 'src/SqlLab/components/TableElement';
import ColumnElement from 'src/SqlLab/components/ColumnElement';

import { mockedActions, table } from './fixtures';

describe('TableElement', () => {
  const mockStore = configureStore([]);
  const store = mockStore({});
  const mockedProps = {
    actions: mockedActions,
    table,
    timeout: 0,
  };
  it('renders', () => {
    expect(React.isValidElement(<TableElement />)).toBe(true);
  });
  it('renders with props', () => {
    expect(React.isValidElement(<TableElement {...mockedProps} />)).toBe(true);
  });
  it('has 2 Link elements', () => {
    const wrapper = shallow(<TableElement {...mockedProps} />);
    expect(wrapper.find(Link)).toHaveLength(2);
  });
  it('has 14 columns', () => {
    const wrapper = shallow(<TableElement {...mockedProps} />);
    expect(wrapper.find(ColumnElement)).toHaveLength(14);
  });
  it('mounts', () => {
    mount(
      <Provider store={store}>
        <TableElement {...mockedProps} />
      </Provider>,
    );
  });
  it('sorts columns', () => {
    const wrapper = shallow(<TableElement {...mockedProps} />);
    expect(wrapper.state().sortColumns).toBe(false);
    expect(wrapper.find(ColumnElement).first().props().column.name).toBe('id');
    wrapper.find('.sort-cols').simulate('click');
    expect(wrapper.state().sortColumns).toBe(true);
    expect(wrapper.find(ColumnElement).first().props().column.name).toBe(
      'active',
    );
  });
  it('calls the collapseTable action', () => {
    const wrapper = mount(
      <Provider store={store}>
        <TableElement {...mockedProps} />
      </Provider>,
    );
    expect(mockedActions.collapseTable.called).toBe(false);
    wrapper.find('.table-name').simulate('click');
    expect(mockedActions.collapseTable.called).toBe(true);
  });
  it('removes the table', () => {
    const wrapper = shallow(<TableElement {...mockedProps} />);
    expect(wrapper.state().expanded).toBe(true);
    wrapper.find('.table-remove').simulate('click');
    expect(wrapper.state().expanded).toBe(false);
    expect(mockedActions.removeDataPreview.called).toBe(true);
  });
});
