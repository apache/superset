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
import { ThemeProvider } from 'emotion-theming';
import { supersetTheme } from '@superset-ui/style';

import DashboardList from 'src/views/dashboardList/DashboardList';
import ListView from 'src/components/ListView/ListView';
import PropertiesModal from 'src/dashboard/components/PropertiesModal';

// store needed for withToasts(DashboardTable)
const mockStore = configureStore([thunk]);
const store = mockStore({});

const dashboardsInfoEndpoint = 'glob:*/api/v1/dashboard/_info*';
const dashboardOwnersEndpoint = 'glob:*/api/v1/dashboard/related/owners*';
const dashboardsEndpoint = 'glob:*/api/v1/dashboard/?*';

const mockDashboards = [...new Array(3)].map((_, i) => ({
  id: i,
  url: 'url',
  dashboard_title: `title ${i}`,
  changed_by_name: 'user',
  changed_by_url: 'changed_by_url',
  changed_by_fk: 1,
  published: true,
  changed_on: new Date().toISOString(),
  owners: [{ first_name: 'admin', last_name: 'admin_user' }],
}));

fetchMock.get(dashboardsInfoEndpoint, {
  permissions: ['can_list', 'can_edit'],
  filters: {
    dashboard_title: [],
    slug: [],
    owners: [],
    published: [],
  },
});
fetchMock.get(dashboardOwnersEndpoint, {
  result: [],
});
fetchMock.get(dashboardsEndpoint, {
  result: mockDashboards,
  dashboard_count: 3,
});

describe('DashboardList', () => {
  const mockedProps = {};
  const wrapper = mount(<DashboardList {...mockedProps} />, {
    context: { store },
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: { theme: supersetTheme },
  });

  it('renders', () => {
    expect(wrapper.find(DashboardList)).toHaveLength(1);
  });

  it('renders a ListView', () => {
    expect(wrapper.find(ListView)).toHaveLength(1);
  });

  it('fetches info', () => {
    const callsI = fetchMock.calls(/dashboard\/_info/);
    expect(callsI).toHaveLength(1);
  });

  it('fetches owners', () => {
    const callsO = fetchMock.calls(/dashboard\/related\/owners/);
    expect(callsO).toHaveLength(1);
  });

  it('fetches data', () => {
    wrapper.update();
    const callsD = fetchMock.calls(/dashboard\/\?q/);
    expect(callsD).toHaveLength(1);
    expect(callsD[0][0]).toMatchInlineSnapshot(
      `"/http//localhost/api/v1/dashboard/?q=(order_column:changed_on,order_direction:desc,page:0,page_size:25)"`,
    );
  });
  it('edits', () => {
    expect(wrapper.find(PropertiesModal)).toHaveLength(0);

    wrapper.find('.fa-pencil').first().simulate('click');
    expect(wrapper.find(PropertiesModal)).toHaveLength(1);
  });
});
