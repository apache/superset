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
import thunk from 'redux-thunk';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import configureStore from 'redux-mock-store';
import ActivityTable from 'src/views/CRUD/welcome/ActivityTable';

const mockStore = configureStore([thunk]);
const store = mockStore({});

const mockData = {
  Viewed: [
    {
      slice_name: 'ChartyChart',
      changed_on_utc: '24 Feb 2014 10:13:14',
      url: '/fakeUrl/explore',
      id: '4',
      table: {},
    },
  ],
  Edited: [
    {
      dashboard_title: 'Dashboard_Test',
      changed_on_utc: '24 Feb 2014 10:13:14',
      url: '/fakeUrl/dashboard',
      id: '3',
    },
  ],
  Created: [
    {
      dashboard_title: 'Dashboard_Test',
      changed_on_utc: '24 Feb 2014 10:13:14',
      url: '/fakeUrl/dashboard',
      id: '3',
    },
  ],
};

describe('ActivityTable', () => {
  const activityProps = {
    activeChild: 'Edited',
    activityData: mockData,
    setActiveChild: jest.fn(),
    user: { userId: '1' },
    loading: false,
  };
  const wrapper = mount(<ActivityTable {...activityProps} />, {
    context: { store },
  });

  beforeAll(async () => {
    await waitForComponentToPaint(wrapper);
  });

  it('the component renders ', () => {
    expect(wrapper.find(ActivityTable)).toExist();
  });
  it('renders tabs with three buttons', () => {
    expect(wrapper.find('li')).toHaveLength(3);
  });
  it('it renders ActivityCards', async () => {
    expect(wrapper.find('ListViewCard')).toExist();
  });
});
