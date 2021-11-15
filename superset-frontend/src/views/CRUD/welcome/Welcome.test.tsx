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
import { act } from 'react-dom/test-utils';
import configureStore from 'redux-mock-store';
import * as featureFlags from 'src/featureFlags';
import Welcome from 'src/views/CRUD/welcome/Welcome';
import { ReactWrapper } from 'enzyme';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';

const mockStore = configureStore([thunk]);
const store = mockStore({});

const chartsEndpoint = 'glob:*/api/v1/chart/?*';
const chartInfoEndpoint = 'glob:*/api/v1/chart/_info?*';
const chartFavoriteStatusEndpoint = 'glob:*/api/v1/chart/favorite_status?*';
const dashboardsEndpoint = 'glob:*/api/v1/dashboard/?*';
const dashboardInfoEndpoint = 'glob:*/api/v1/dashboard/_info?*';
const dashboardFavoriteStatusEndpoint =
  'glob:*/api/v1/dashboard/favorite_status?*';
const savedQueryEndpoint = 'glob:*/api/v1/saved_query/?*';
const savedQueryInfoEndpoint = 'glob:*/api/v1/saved_query/_info?*';
const recentActivityEndpoint = 'glob:*/superset/recent_activity/*';

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

fetchMock.get(dashboardsEndpoint, {
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

fetchMock.get(recentActivityEndpoint, {
  Created: [],
  Viewed: [],
});

fetchMock.get(chartInfoEndpoint, {
  permissions: [],
});

fetchMock.get(chartFavoriteStatusEndpoint, {
  result: [],
});

fetchMock.get(dashboardInfoEndpoint, {
  permissions: [],
});

fetchMock.get(dashboardFavoriteStatusEndpoint, {
  result: [],
});

fetchMock.get(savedQueryInfoEndpoint, {
  permissions: [],
});

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

describe('Welcome', () => {
  let wrapper: ReactWrapper;

  beforeAll(async () => {
    await act(async () => {
      wrapper = mount(
        <Provider store={store}>
          <Welcome {...mockedProps} />
        </Provider>,
      );
    });
  });

  it('renders', () => {
    expect(wrapper).toExist();
  });

  it('renders all panels on the page on page load', () => {
    expect(wrapper.find('CollapsePanel')).toHaveLength(8);
  });

  it('calls api methods in parallel on page load', () => {
    const chartCall = fetchMock.calls(/chart\/\?q/);
    const savedQueryCall = fetchMock.calls(/saved_query\/\?q/);
    const recentCall = fetchMock.calls(/superset\/recent_activity\/*/);
    const dashboardCall = fetchMock.calls(/dashboard\/\?q/);
    expect(chartCall).toHaveLength(2);
    expect(recentCall).toHaveLength(1);
    expect(savedQueryCall).toHaveLength(1);
    expect(dashboardCall).toHaveLength(2);
  });
});

async function mountAndWait(props = mockedProps) {
  const wrapper = mount(
    <Provider store={store}>
      <Welcome {...props} />
    </Provider>,
  );
  await waitForComponentToPaint(wrapper);
  return wrapper;
}

describe('Welcome page with toggle switch', () => {
  let wrapper: ReactWrapper;
  let isFeatureEnabledMock: any;

  beforeAll(async () => {
    isFeatureEnabledMock = jest
      .spyOn(featureFlags, 'isFeatureEnabled')
      .mockReturnValue(true);
    await act(async () => {
      wrapper = await mountAndWait();
    });
  });

  afterAll(() => {
    isFeatureEnabledMock.restore();
  });

  it('shows a toggle button when feature flags is turned on', async () => {
    await waitForComponentToPaint(wrapper);
    expect(wrapper.find('Switch')).toExist();
  });
  it('does not show thumbnails when switch is off', async () => {
    act(() => {
      // @ts-ignore
      wrapper.find('button[role="switch"]').props().onClick();
    });
    await waitForComponentToPaint(wrapper);
    expect(wrapper.find('ImageLoader')).not.toExist();
  });
});
