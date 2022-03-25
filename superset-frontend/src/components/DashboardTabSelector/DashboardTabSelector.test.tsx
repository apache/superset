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
import { render, screen } from 'spec/helpers/testing-library';
import { Provider } from 'react-redux';

import DashboardTabSelector, {
  DashboardTabSelectorProps,
} from 'src/components/DashboardTabSelector';
import { act } from '@testing-library/react';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import fetchMock from 'fetch-mock';

const dashboardLayout1 = {
  'CHART-FjtCQPgZOx': {
    children: [],
    id: 'CHART-FjtCQPgZOx',
    meta: {
      chartId: 81,
      height: 50,
      sliceName: 'Genders by State',
      uuid: '2ee89846-9804-45eb-a9f5-fe0786b1f710',
      width: 4,
    },
    parents: ['ROOT_ID', 'GRID_ID', 'ROW-ic2oksaIhH'],
    type: 'CHART',
  },
  'CHART-_LqISX5Dmk': {
    children: [],
    id: 'CHART-_LqISX5Dmk',
    meta: {
      chartId: 89,
      height: 50,
      sliceName: 'Num Births Trend',
      uuid: 'ba559fb8-9f34-4cd7-aba3-ce480cdb50ce',
      width: 4,
    },
    parents: ['ROOT_ID', 'GRID_ID', 'ROW-ic2oksaIhH'],
    type: 'CHART',
  },
  'CHART-dQoWBYrEuT': {
    children: [],
    id: 'CHART-dQoWBYrEuT',
    meta: {
      chartId: 90,
      height: 50,
      sliceName: 'Daily Totals',
      uuid: '8059e7e2-270d-4850-b825-000c49f1d0eb',
      width: 4,
    },
    parents: ['ROOT_ID', 'GRID_ID', 'ROW-ic2oksaIhH'],
    type: 'CHART',
  },
  DASHBOARD_VERSION_KEY: 'v2',
  GRID_ID: {
    children: ['ROW-ic2oksaIhH'],
    id: 'GRID_ID',
    parents: ['ROOT_ID'],
    type: 'GRID',
  },
  HEADER_ID: {
    id: 'HEADER_ID',
    meta: {
      text: 'Births name dashboard',
    },
    type: 'HEADER',
  },
  ROOT_ID: {
    children: ['GRID_ID'],
    id: 'ROOT_ID',
    type: 'ROOT',
  },
  'ROW-ic2oksaIhH': {
    children: ['CHART-FjtCQPgZOx', 'CHART-_LqISX5Dmk', 'CHART-dQoWBYrEuT'],
    id: 'ROW-ic2oksaIhH',
    meta: {
      background: 'BACKGROUND_TRANSPARENT',
    },
    parents: ['ROOT_ID', 'GRID_ID'],
    type: 'ROW',
  },
};
const dashboardLayout2 = {
  'CHART-DyEB8hDI7O': {
    children: [],
    id: 'CHART-DyEB8hDI7O',
    meta: {
      chartId: 90,
      height: 50,
      sliceName: 'Daily Totals',
      uuid: '8059e7e2-270d-4850-b825-000c49f1d0eb',
      width: 4,
    },
    parents: ['ROOT_ID', 'TABS-A0Bgh8cTQp', 'TAB-CpsuJo-SPT', 'ROW-fyUmwkmlNR'],
    type: 'CHART',
  },
  'CHART-GmxtoPCN-w': {
    children: [],
    id: 'CHART-GmxtoPCN-w',
    meta: {
      chartId: 88,
      height: 50,
      sliceName: 'Average and Sum Trends',
      uuid: '4faab884-87bf-4a92-8a13-ea04d12d46e9',
      width: 4,
    },
    parents: ['ROOT_ID', 'TABS-A0Bgh8cTQp', 'TAB-rQn3lUyTL', 'ROW-3MmQtwyIxO'],
    type: 'CHART',
  },
  'CHART-VsQn1ux0Kt': {
    children: [],
    id: 'CHART-VsQn1ux0Kt',
    meta: {
      chartId: 87,
      height: 50,
      sliceName: 'Top 10 Boy Name Share',
      uuid: 'b28e82f8-3375-4450-935a-3ee9bf63f1f1',
      width: 4,
    },
    parents: ['ROOT_ID', 'TABS-A0Bgh8cTQp', 'TAB-rQn3lUyTL', 'ROW-3MmQtwyIxO'],
    type: 'CHART',
  },
  'CHART-p5LStCs3qU': {
    children: [],
    id: 'CHART-p5LStCs3qU',
    meta: {
      chartId: 89,
      height: 50,
      sliceName: 'Num Births Trend',
      uuid: 'ba559fb8-9f34-4cd7-aba3-ce480cdb50ce',
      width: 4,
    },
    parents: ['ROOT_ID', 'TABS-A0Bgh8cTQp', 'TAB-CpsuJo-SPT', 'ROW-fyUmwkmlNR'],
    type: 'CHART',
  },
  DASHBOARD_VERSION_KEY: 'v2',
  GRID_ID: {
    children: [],
    id: 'GRID_ID',
    parents: ['ROOT_ID'],
    type: 'GRID',
  },
  HEADER_ID: {
    id: 'HEADER_ID',
    meta: {
      text: 'Dashboard with tabs',
    },
    type: 'HEADER',
  },
  ROOT_ID: {
    children: ['TABS-A0Bgh8cTQp'],
    id: 'ROOT_ID',
    type: 'ROOT',
  },
  'ROW-3MmQtwyIxO': {
    children: ['CHART-GmxtoPCN-w', 'CHART-VsQn1ux0Kt'],
    id: 'ROW-3MmQtwyIxO',
    meta: {
      background: 'BACKGROUND_TRANSPARENT',
    },
    parents: ['ROOT_ID', 'TABS-A0Bgh8cTQp', 'TAB-rQn3lUyTL'],
    type: 'ROW',
  },
  'ROW-fyUmwkmlNR': {
    children: ['CHART-DyEB8hDI7O', 'CHART-p5LStCs3qU'],
    id: 'ROW-fyUmwkmlNR',
    meta: {
      background: 'BACKGROUND_TRANSPARENT',
    },
    parents: ['ROOT_ID', 'TABS-A0Bgh8cTQp', 'TAB-CpsuJo-SPT'],
    type: 'ROW',
  },
  'TAB-CpsuJo-SPT': {
    children: ['ROW-fyUmwkmlNR'],
    id: 'TAB-CpsuJo-SPT',
    meta: {
      defaultText: 'Tab title',
      placeholder: 'Tab title',
      text: 'Tab 1',
    },
    parents: ['ROOT_ID', 'TABS-A0Bgh8cTQp'],
    type: 'TAB',
  },
  'TAB-rQn3lUyTL': {
    children: ['ROW-3MmQtwyIxO'],
    id: 'TAB-rQn3lUyTL',
    meta: {
      defaultText: 'Tab title',
      placeholder: 'Tab title',
      text: 'Tab 2',
    },
    parents: ['ROOT_ID', 'TABS-A0Bgh8cTQp'],
    type: 'TAB',
  },
  'TABS-A0Bgh8cTQp': {
    children: ['TAB-CpsuJo-SPT', 'TAB-rQn3lUyTL'],
    id: 'TABS-A0Bgh8cTQp',
    meta: {},
    parents: ['ROOT_ID'],
    type: 'TABS',
  },
};
const mockAPI = [
  {
    endpoint: 'glob:*/api/v1/dashboard/1',
    response: {
      result: {
        charts: ['Genders by State', 'Num Births Trend', 'Daily Totals'],
        dashboard_title: 'Births name dashboard',
        id: 1,
        position_json: JSON.stringify(dashboardLayout1),
      },
    },
  },
  {
    endpoint: 'glob:*/api/v1/dashboard/2',
    response: {
      result: {
        charts: [
          'Top 10 Boy Name Share',
          'Average and Sum Trends',
          'Num Births Trend',
          'Daily Totals',
        ],
        dashboard_title: 'Dashboard with tabs',
        id: 2,
        position_json: JSON.stringify(dashboardLayout2),
      },
    },
  },
];
mockAPI.forEach(({ endpoint, response }) => {
  fetchMock.get(endpoint, response);
});
const chartsInTab1 = [
  mockAPI[1].response.result.charts[2],
  mockAPI[1].response.result.charts[3],
];
const chartsInTab2 = [
  mockAPI[1].response.result.charts[0],
  mockAPI[1].response.result.charts[1],
];

const mockStore = configureStore([thunk]);
const store = mockStore({});

async function setup(props: DashboardTabSelectorProps) {
  await act(async () => {
    render(
      <Provider store={store}>
        <DashboardTabSelector {...props} />
      </Provider>,
    );
  });
}

describe('DashboardTabSelector', () => {
  it('renders dashboard without tab', async () => {
    await setup({
      dashboardId: 1,
      selectedTabs: [],
      onChange: () => {},
    });
    // all chart should be visible
    mockAPI[0].response.result.charts.forEach(chartName => {
      expect(screen.getByText(chartName)).toBeVisible();
    });
  });

  it('renders dashboard with tab', async () => {
    await setup({
      dashboardId: 2,
      selectedTabs: [],
      onChange: () => {},
    });
    // only charts in tab 1 are visible
    chartsInTab1.forEach(chartName => {
      expect(screen.getByText(chartName)).toBeVisible();
    });
  });

  it('renders dashboard with pre-selected tab', async () => {
    await setup({
      dashboardId: 2,
      selectedTabs: ['TAB-rQn3lUyTL'],
      onChange: () => {},
    });
    // only charts in tab 1 are visible
    chartsInTab2.forEach(chartName => {
      expect(screen.getByText(chartName)).toBeVisible();
    });
  });
});
