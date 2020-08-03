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
import { mount } from 'enzyme';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import { supersetTheme, ThemeProvider } from '@superset-ui/style';

import ListView from 'src/components/ListView/ListView';
import DashboardTable from 'src/welcome/DashboardTable';

// store needed for withToasts(DashboardTable)
const mockStore = configureStore([thunk]);
const store = mockStore({});

const dashboardsEndpoint = 'glob:*/api/v1/dashboard/*';
const mockDashboards = [{ id: 1, url: 'url', dashboard_title: 'title' }];

fetchMock.get(dashboardsEndpoint, { result: mockDashboards });

function setup() {
  // use mount because data fetching is triggered on mount
  return mount(<DashboardTable />, {
    context: { store },
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: { theme: supersetTheme },
  });
}

describe('DashboardTable', () => {
  beforeEach(fetchMock.resetHistory);

  it('fetches dashboards and renders a ListView', () => {
    return new Promise(done => {
      const wrapper = setup();

      setTimeout(() => {
        expect(fetchMock.calls(dashboardsEndpoint)).toHaveLength(1);
        // there's a delay between response and updating state, so manually set it
        // rather than adding a timeout which could introduce flakiness
        wrapper.setState({ dashboards: mockDashboards });
        expect(wrapper.find(ListView)).toExist();
        done();
      });
    });
  });
});
