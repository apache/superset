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
import { styledMount as mount } from 'spec/helpers/theming';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import { act } from 'react-dom/test-utils';

import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import DashboardCard from 'src/features/dashboards/DashboardCard';
import DashboardTable from './DashboardTable';

// store needed for withToasts(DashboardTable)
const mockStore = configureStore([thunk]);
const store = mockStore({});

const dashboardsEndpoint = 'glob:*/api/v1/dashboard/?*';
const dashboardInfoEndpoint = 'glob:*/api/v1/dashboard/_info*';
const dashboardFavEndpoint = 'glob:*/api/v1/dashboard/favorite_status?*';
const mockDashboards = [
  {
    id: 1,
    url: 'url',
    dashboard_title: 'title',
    changed_on_utc: '24 Feb 2014 10:13:14',
  },
];

fetchMock.get(dashboardsEndpoint, { result: mockDashboards });
fetchMock.get(dashboardInfoEndpoint, {
  permissions: ['can_list', 'can_edit', 'can_delete'],
});
fetchMock.get(dashboardFavEndpoint, {
  result: [],
});

describe('DashboardTable', () => {
  const dashboardProps = {
    dashboardFilter: 'Favorite',
    user: {
      userId: '2',
    },
    mine: mockDashboards,
  };
  let wrapper = mount(<DashboardTable store={store} {...dashboardProps} />);

  beforeAll(async () => {
    await waitForComponentToPaint(wrapper);
  });

  it('renders', () => {
    expect(wrapper.find(DashboardTable)).toExist();
  });

  it('render a submenu with clickable tabs and buttons', async () => {
    expect(wrapper.find('SubMenu')).toExist();
    expect(wrapper.find('[role="tab"]')).toHaveLength(2);
    expect(wrapper.find('Button')).toHaveLength(6);
    act(() => {
      const handler = wrapper.find('[role="tab"] a').at(0).prop('onClick');
      if (handler) {
        handler({} as any);
      }
    });
    await waitForComponentToPaint(wrapper);
    expect(fetchMock.calls(/dashboard\/\?q/)).toHaveLength(1);
  });

  it('render DashboardCard', () => {
    expect(wrapper.find(DashboardCard)).toExist();
  });

  it('display EmptyState if there is no data', async () => {
    await act(async () => {
      wrapper = mount(
        <DashboardTable
          dashboardFilter="Mine"
          user={{ userId: '2' }}
          mine={[]}
          store={store}
        />,
      );
    });

    expect(wrapper.find('EmptyState')).toExist();
  });
});
