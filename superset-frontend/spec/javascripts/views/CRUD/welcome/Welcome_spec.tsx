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
import thunk from 'redux-thunk';
import fetchMock from 'fetch-mock';
import configureStore from 'redux-mock-store';
import Welcome from 'src/views/CRUD/welcome/Welcome';

const mockStore = configureStore([thunk]);
const store = mockStore({});

const chartsEndpoint = 'glob:*/api/v1/chart/?*';
const dashboardEndpoint = 'glob:*/api/v1/dashboard/?*';
const savedQueryEndpoint = 'glob:*/api/v1/saved_query/?*';

fetchMock.get(chartsEndpoint, {
  result: [
    {
      slice_name: 'ChartyChart',
      changed_on_utc: '24 Feb 2014 10:13:14',
      url: '/fakeUrl/explore',
      id: '4',
      table: {},
    },
  ],
});

fetchMock.get(dashboardEndpoint, {
  result: [
    {
      dashboard_title: 'Dashboard_Test',
      changed_on_utc: '24 Feb 2014 10:13:14',
      url: '/fakeUrl/dashboard',
      id: '3',
    },
  ],
});

fetchMock.get(savedQueryEndpoint, {
  result: [],
});

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
  const wrapper = mount(
    <Provider store={store}>
      <Welcome {...mockedProps} />
    </Provider>,
  );

  it('renders', () => {
    expect(wrapper).toExist();
  });

  it('renders all panels on the page on page load', () => {
    expect(wrapper.find('CollapsePanel')).toHaveLength(8);
  });

  it('calls batch method on page load', () => {
    const chartCall = fetchMock.calls(/chart\/\?q/);
    const dashboardCall = fetchMock.calls(/dashboard\/\?q/);
    expect(chartCall).toHaveLength(2);
    expect(dashboardCall).toHaveLength(2);
  });
});
