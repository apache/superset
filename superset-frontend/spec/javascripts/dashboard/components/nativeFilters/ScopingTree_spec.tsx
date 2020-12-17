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
import { Provider } from 'react-redux';
import ScopingTree from 'src/dashboard/components/nativeFilters/ScopingTree';
import { styledMount as mount } from 'spec/helpers/theming';
import { mockStore } from 'spec/fixtures/mockStore';

describe('ScopingTree', () => {
  const mock = jest.fn();
  const wrapper = mount(
    <Provider store={mockStore}>
      <ScopingTree setFilterScope={mock} />
    </Provider>,
  );
  it('is valid', () => {
    const mock = () => null;
    expect(React.isValidElement(<ScopingTree setFilterScope={mock} />)).toBe(
      true,
    );
  });
  it('renders a tree', () => {
    expect(wrapper.find('TreeNode')).toExist();
  });
});
