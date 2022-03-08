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
import { styledMount as mount } from 'spec/helpers/theming';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import { AntdDropdown } from 'src/components';
import { Menu } from 'src/components/Menu';
import ExploreAdditionalActionsMenu from 'src/explore/components/ExploreAdditionalActionsMenu';

const mockStore = configureStore([thunk]);
const store = mockStore({});

describe('ExploreAdditionalActionsMenu', () => {
  const defaultProps = {
    animation: false,
    queryResponse: {
      query: 'SELECT * FROM foo',
      language: 'sql',
    },
    chartStatus: 'success',
    queryEndpoint: 'localhost',
    latestQueryFormData: {
      datasource: '1__table',
    },
    chartHeight: '30px',
  };

  it('is valid', () => {
    expect(
      React.isValidElement(<ExploreAdditionalActionsMenu {...defaultProps} />),
    ).toBe(true);
  });
  it('renders a dropdown with 3 items', () => {
    const wrapper = mount(
      <ExploreAdditionalActionsMenu store={store} {...defaultProps} />,
    );
    const dropdown = wrapper.find(AntdDropdown);
    const menu = shallow(<div>{dropdown.prop('overlay')}</div>);
    const menuItems = menu.find(Menu.Item);
    expect(menuItems).toHaveLength(3);
  });
});
