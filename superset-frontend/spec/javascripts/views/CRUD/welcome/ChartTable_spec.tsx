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
import fetchMock from 'fetch-mock';

import configureStore from 'redux-mock-store';
import ChartTable from 'src/views/CRUD/welcome/ChartTable';
import ChartCard from 'src/views/CRUD/chart/ChartCard';

// store needed for withToasts(DashboardTable)
const mockStore = configureStore([thunk]);
const store = mockStore({});

const chartsEndpoint = 'glob:*/api/v1/chart/?*';
// fetchMock.get(chartsEndpoint, { result: mockDashboards });

const mockCharts = [...new Array(3)].map((_, i) => ({
  changed_on_utc: new Date().toISOString(),
  created_by: 'super user',
  id: i,
  slice_name: `cool chart ${i}`,
  url: 'url',
  viz_type: 'bar',
  datasource_title: `ds${i}`,
  thumbnail_url: '/thumbnail',
}));

/* fetchMock.get(chartsEndpoint, {
  result: [],
});
*/
fetchMock.get(chartsEndpoint, {
  result: mockCharts,
});

describe('DashboardTable', () => {
  beforeEach(fetchMock.resetHistory);

  const mockedProps = {};
  const wrapper = mount(<ChartTable {...mockedProps} />, {
    context: { store },
  });

  /*beforeAll(async () => {
    await waitForComponentToPaint(wrapper);
  });*/

  it('it renders', () => {
    expect(wrapper.find(ChartTable)).toExist();
  });
  it('fetches chart favorites and renders chart cards ', () => {
      console.log('mock call', fetchMock.calls(/chart\/\?q/))
    expect(fetchMock.calls(chartsEndpoint)).toHaveLength(1);
    console.log('wrapper', wrapper.dive());
    // there's a delay between response and updating state, so manually set it
    // rather than adding a timeout which could introduce flakiness
    // wrapper.setState({ dashboards: mockDashboards });
    expect(wrapper.find(ChartCard)).toExist();
  });
});
