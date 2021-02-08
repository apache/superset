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
import { shallow } from 'enzyme';
import QueryTable from 'src/SqlLab/components/QueryTable';
import TableView from 'src/components/TableView';
import { TableCollection } from 'src/components/dataViewCommon';
import { queries } from './fixtures';

describe('QueryTable', () => {
  const mockedProps = {
    queries,
    displayLimit: 100,
  };
  it('is valid', () => {
    expect(React.isValidElement(<QueryTable displayLimit={100} />)).toBe(true);
  });
  it('is valid with props', () => {
    expect(React.isValidElement(<QueryTable {...mockedProps} />)).toBe(true);
  });
  it('renders a proper table', () => {
    const wrapper = shallow(<QueryTable {...mockedProps} />);
    const tableWrapper = wrapper
      .find(TableView)
      .shallow()
      .find(TableCollection)
      .shallow();
    expect(wrapper.find(TableView)).toExist();
    expect(tableWrapper.find('table')).toExist();
    expect(tableWrapper.find('table').find('thead').find('tr')).toHaveLength(1);
    expect(tableWrapper.find('table').find('tbody').find('tr')).toHaveLength(2);
  });
});
