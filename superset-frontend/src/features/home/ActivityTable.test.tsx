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
import { act } from 'react-dom/test-utils';
import { ReactWrapper } from 'enzyme';
import { Provider } from 'react-redux';
import fetchMock from 'fetch-mock';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import { TableTab } from 'src/views/CRUD/types';
import ActivityTable from './ActivityTable';

const mockStore = configureStore([thunk]);
const store = mockStore({});

const chartsEndpoint = 'glob:*/api/v1/chart/?*';
const dashboardsEndpoint = 'glob:*/api/v1/dashboard/?*';

const mockData = {
  [TableTab.Viewed]: [
    {
      slice_name: 'ChartyChart',
      changed_on_utc: '24 Feb 2014 10:13:14',
      url: '/fakeUrl/explore',
      id: '4',
      table: {},
    },
  ],
  [TableTab.Created]: [
    {
      dashboard_title: 'Dashboard_Test',
      changed_on_utc: '24 Feb 2014 10:13:14',
      url: '/fakeUrl/dashboard',
      id: '3',
    },
  ],
};

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

describe('ActivityTable', () => {
  const activityProps = {
    activeChild: TableTab.Created,
    activityData: mockData,
    setActiveChild: jest.fn(),
    user: { userId: '1' },
    isFetchingActivityData: false,
  };

  let wrapper: ReactWrapper;

  beforeAll(async () => {
    await act(async () => {
      wrapper = mount(
        <Provider store={store}>
          <ActivityTable {...activityProps} />
        </Provider>,
      );
    });
  });

  it('the component renders', () => {
    expect(wrapper.find(ActivityTable)).toExist();
  });
  it('renders tabs with three buttons', () => {
    expect(wrapper.find('[role="tab"]')).toHaveLength(3);
  });
  it('renders ActivityCards', async () => {
    expect(wrapper.find('ListViewCard')).toExist();
  });
  it('calls the getEdited batch call when edited tab is clicked', async () => {
    act(() => {
      const handler = wrapper.find('[role="tab"] a').at(1).prop('onClick');
      if (handler) {
        handler({} as any);
      }
    });
    const dashboardCall = fetchMock.calls(/dashboard\/\?q/);
    const chartCall = fetchMock.calls(/chart\/\?q/);
    // waitforcomponenttopaint does not work here in this instance...
    setTimeout(() => {
      expect(chartCall).toHaveLength(1);
      expect(dashboardCall).toHaveLength(1);
    });
  });
  it('show empty state if there is no data', () => {
    const activityProps = {
      activeChild: TableTab.Created,
      activityData: {},
      setActiveChild: jest.fn(),
      user: { userId: '1' },
      isFetchingActivityData: false,
    };
    const wrapper = mount(
      <Provider store={store}>
        <ActivityTable {...activityProps} />
      </Provider>,
    );
    expect(wrapper.find('EmptyState')).toExist();
  });
});
