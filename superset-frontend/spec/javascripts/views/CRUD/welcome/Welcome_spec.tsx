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
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import Welcome from 'src/views/CRUD/welcome/Welcome';

const mockStore = configureStore([thunk]);
const store = mockStore({});

describe('Welcome', () => {
  const mockedProps = {
    user: {
      username: 'alpha',
      firstName: 'alpha',
      lastName: 'alpha',
      createdOn: '2016-11-11T12:34:17',
      userId: 5,
      email: 'alpha@alpha.com',
      isActive: true,
    },
  };
  const wrapper = shallow(<Welcome {...mockedProps} />, {
    context: { store },
  });

  it('renders', () => {
    expect(wrapper).toExist();
  });

  it('renders all panels on the page on page load', () => {
    expect(wrapper.find('CollapsePanel')).toHaveLength(4);
  });
});
