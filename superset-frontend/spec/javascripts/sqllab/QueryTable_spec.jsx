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
import { Table } from 'reactable-arc';
import QueryTable from 'src/SqlLab/components/QueryTable';

import { queries } from './fixtures';

describe('QueryTable', () => {
  const mockedProps = {
    queries,
  };
  it('is valid', () => {
    expect(React.isValidElement(<QueryTable />)).toBe(true);
  });
  it('is valid with props', () => {
    expect(React.isValidElement(<QueryTable {...mockedProps} />)).toBe(true);
  });
  it('renders a proper table', () => {
    const wrapper = shallow(<QueryTable {...mockedProps} />);
    expect(wrapper.find(Table)).toHaveLength(1);
    expect(wrapper.find(Table).shallow().find('table')).toHaveLength(1);
    expect(wrapper.find(Table).shallow().find('table').find('Tr')).toHaveLength(
      2,
    );
  });
});
