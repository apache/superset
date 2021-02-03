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
import { Provider } from 'react-redux';
import FilterBar from 'src/dashboard/components/nativeFilters/FilterBar';
import Button from 'src/components/Button';
import { mockStore } from 'spec/fixtures/mockStore';

describe('FilterBar', () => {
  const props = {
    filtersOpen: false,
    toggleFiltersBar: jest.fn(),
  };

  const wrapper = mount(
    <Provider store={mockStore}>
      <FilterBar {...props} />
    </Provider>,
  );

  it('is a valid', () => {
    expect(React.isValidElement(<FilterBar {...props} />)).toBe(true);
  });
  it('has filter and collapse icons', () => {
    expect(wrapper.find({ name: 'filter' })).toExist();
    expect(wrapper.find({ name: 'collapse' })).toExist();
  });
  it('has apply and reset all buttons', () => {
    expect(wrapper.find(Button).length).toBe(2);
    expect(wrapper.find(Button).at(0)).toHaveProp('buttonStyle', 'secondary');
    expect(wrapper.find(Button).at(1)).toHaveProp('buttonStyle', 'primary');
  });
});
