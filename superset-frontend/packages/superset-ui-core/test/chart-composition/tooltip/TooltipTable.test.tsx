/*
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
import { TooltipTable } from '@superset-ui/core';

describe('TooltipTable', () => {
  it('sets className', () => {
    const wrapper = shallow(<TooltipTable className="test-class" />);
    expect(wrapper.render().hasClass('test-class')).toEqual(true);
  });

  it('renders empty table', () => {
    const wrapper = shallow(<TooltipTable />);
    expect(wrapper.find('tbody')).toHaveLength(1);
    expect(wrapper.find('tr')).toHaveLength(0);
  });

  it('renders table with content', () => {
    const wrapper = shallow(
      <TooltipTable
        data={[
          {
            key: 'Cersei',
            keyColumn: 'Cersei',
            keyStyle: { padding: '10' },
            valueColumn: 2,
            valueStyle: { textAlign: 'right' },
          },
          {
            key: 'Jaime',
            keyColumn: 'Jaime',
            keyStyle: { padding: '10' },
            valueColumn: 1,
            valueStyle: { textAlign: 'right' },
          },
          {
            key: 'Tyrion',
            keyStyle: { padding: '10' },
            valueColumn: 2,
          },
        ]}
      />,
    );
    expect(wrapper.find('tbody')).toHaveLength(1);
    expect(wrapper.find('tr')).toHaveLength(3);
    expect(wrapper.find('tr > td').first().text()).toEqual('Cersei');
  });
});
