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
import { styledMount as mount } from 'spec/helpers/theming';
import ColumnElement from 'src/SqlLab/components/ColumnElement';
import { mockedActions, table } from 'src/SqlLab/fixtures';

describe('ColumnElement', () => {
  const mockedProps = {
    actions: mockedActions,
    column: table.columns[0],
  };
  it('is valid with props', () => {
    expect(React.isValidElement(<ColumnElement {...mockedProps} />)).toBe(true);
  });
  it('renders a proper primary key', () => {
    const wrapper = mount(<ColumnElement column={table.columns[0]} />);
    expect(wrapper.find('i.fa-key')).toExist();
    expect(wrapper.find('.col-name').first().text()).toBe('id');
  });
  it('renders a multi-key column', () => {
    const wrapper = mount(<ColumnElement column={table.columns[1]} />);
    expect(wrapper.find('i.fa-link')).toExist();
    expect(wrapper.find('i.fa-bookmark')).toExist();
    expect(wrapper.find('.col-name').first().text()).toBe('first_name');
  });
  it('renders a column with no keys', () => {
    const wrapper = mount(<ColumnElement column={table.columns[2]} />);
    expect(wrapper.find('i')).not.toExist();
    expect(wrapper.find('.col-name').first().text()).toBe('last_name');
  });
});
