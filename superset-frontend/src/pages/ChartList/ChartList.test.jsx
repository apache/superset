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
import { MemoryRouter } from 'react-router-dom';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import * as reactRedux from 'react-redux';
import fetchMock from 'fetch-mock';
import { VizType, isFeatureEnabled } from '@superset-ui/core';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { QueryParamProvider } from 'use-query-params';

import ChartList from 'src/pages/ChartList';

// Increase default timeout for all tests
jest.setTimeout(30000);

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockCharts = [...new Array(3)].map((_, i) => ({
  changed_on: new Date().toISOString(),
  creator: 'super user',
  id: i,
  slice_name: `cool chart ${i}`,
  url: 'url',
  viz_type: VizType.Bar,
  datasource_name: `ds${i}`,
  thumbnail_url: '/thumbnail',
}));

const mockUser = {
  userId: 1,
};

const chartsInfoEndpoint = 'glob:*/api/v1/chart/_info*';
const chartsOwnersEndpoint = 'glob:*/api/v1/chart/related/owners*';
const chartsCreatedByEndpoint = 'glob:*/api/v1/chart/related/created_by*';
const chartsEndpoint = 'glob:*/api/v1/chart/*';
const chartsVizTypesEndpoint = 'glob:*/api/v1/chart/viz_types';
const chartsDatasourcesEndpoint = 'glob:*/api/v1/chart/datasources';
const chartFavoriteStatusEndpoint = 'glob:*/api/v1/chart/favorite_status*';
const datasetEndpoint = 'glob:*/api/v1/dataset/*';

fetchMock.get(chartsInfoEndpoint, {
  permissions: ['can_read', 'can_write'],
});
fetchMock.get(chartsOwnersEndpoint, {
  result: [],
});
fetchMock.get(chartsCreatedByEndpoint, {
  result: [],
});
fetchMock.get(chartFavoriteStatusEndpoint, {
  result: mockCharts.map(chart => ({ id: chart.id, value: true })),
});
fetchMock.get(chartsEndpoint, {
  result: mockCharts,
  chart_count: 3,
});
fetchMock.get(chartsVizTypesEndpoint, {
  result: [],
  count: 0,
});
fetchMock.get(chartsDatasourcesEndpoint, {
  result: [],
  count: 0,
});
fetchMock.get(datasetEndpoint, {});

global.URL.createObjectURL = jest.fn();
fetchMock.get('/thumbnail', { body: new Blob(), sendAsJson: false });

const user = {
  createdOn: '2021-04-27T18:12:38.952304',
  email: 'admin',
  firstName: 'admin',
  isActive: true,
  lastName: 'admin',
  permissions: {},
  roles: {
    Admin: [
      ['can_sqllab', 'Superset'],
      ['can_write', 'Dashboard'],
      ['can_write', 'Chart'],
    ],
  },
  userId: 1,
  username: 'admin',
};

const mockStore = configureStore([thunk]);
const store = mockStore({ user });
const useSelectorMock = jest.spyOn(reactRedux, 'useSelector');

const renderChartList = (props = {}) =>
  render(
    <MemoryRouter>
      <QueryParamProvider>
        <ChartList {...props} user={mockUser} />
      </QueryParamProvider>
    </MemoryRouter>,
    {
      useRedux: true,
      store,
    },
  );

describe('ChartList', () => {
  beforeEach(() => {
    isFeatureEnabled.mockImplementation(
      feature => feature === 'LISTVIEWS_DEFAULT_CARD_VIEW',
    );
    fetchMock.resetHistory();
    useSelectorMock.mockClear();
  });

  afterAll(() => {
    isFeatureEnabled.mockRestore();
  });

  it('renders', async () => {
    renderChartList();
    expect(await screen.findByText('Charts')).toBeInTheDocument();
  });

  it('renders a ListView', async () => {
    renderChartList();
    expect(await screen.findByTestId('chart-list-view')).toBeInTheDocument();
  });

  it('fetches info', async () => {
    renderChartList();
    await waitFor(() => {
      const calls = fetchMock.calls(/chart\/_info/);
      expect(calls).toHaveLength(1);
    });
  });

  it('fetches data', async () => {
    renderChartList();
    await waitFor(() => {
      const calls = fetchMock.calls(/chart\/\?q/);
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toContain(
        'order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:25',
      );
    });
  });

  it('switches between card and table view', async () => {
    renderChartList();

    // Wait for list to load
    await screen.findByTestId('chart-list-view');

    // Find and click list view toggle
    const listViewToggle = await screen.findByRole('img', {
      name: 'list-view',
    });
    const listViewButton = listViewToggle.closest('[role="button"]');
    fireEvent.click(listViewButton);

    // Wait for list view to be active
    await waitFor(() => {
      const listViewToggle = screen.getByRole('img', { name: 'list-view' });
      expect(listViewToggle.closest('[role="button"]')).toHaveClass('active');
    });

    // Find and click card view toggle
    const cardViewToggle = screen.getByRole('img', { name: 'card-view' });
    const cardViewButton = cardViewToggle.closest('[role="button"]');
    fireEvent.click(cardViewButton);

    // Wait for card view to be active
    await waitFor(() => {
      const cardViewToggle = screen.getByRole('img', { name: 'card-view' });
      expect(cardViewToggle.closest('[role="button"]')).toHaveClass('active');
    });
  });

  it('shows edit modal', async () => {
    renderChartList();

    // Wait for list to load
    await screen.findByTestId('chart-list-view');

    // Switch to list view
    const listViewToggle = await screen.findByRole('img', {
      name: 'list-view',
    });
    const listViewButton = listViewToggle.closest('[role="button"]');
    fireEvent.click(listViewButton);

    // Wait for list view to be active and data to load
    await waitFor(() => {
      expect(screen.getByText('cool chart 0')).toBeInTheDocument();
    });

    // Click edit button
    const editButtons = await screen.findAllByTestId('edit-alt');
    fireEvent.click(editButtons[0]);

    // Verify modal appears
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('shows delete modal', async () => {
    renderChartList();

    // Wait for list to load
    await screen.findByTestId('chart-list-view');

    // Switch to list view
    const listViewToggle = await screen.findByRole('img', {
      name: 'list-view',
    });
    const listViewButton = listViewToggle.closest('[role="button"]');
    fireEvent.click(listViewButton);

    // Wait for list view to be active and data to load
    await waitFor(() => {
      expect(screen.getByText('cool chart 0')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButtons = await screen.findAllByTestId('trash');
    fireEvent.click(deleteButtons[0]);

    // Verify modal appears
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('shows favorite stars for logged in user', async () => {
    renderChartList();

    // Wait for list to load
    await screen.findByTestId('chart-list-view');

    // Switch to list view
    const listViewToggle = await screen.findByRole('img', {
      name: 'list-view',
    });
    const listViewButton = listViewToggle.closest('[role="button"]');
    fireEvent.click(listViewButton);

    // Wait for list view to be active and data to load
    await waitFor(() => {
      expect(screen.getByText('cool chart 0')).toBeInTheDocument();
    });

    // Wait for favorite stars to appear
    await waitFor(() => {
      const favoriteStars = screen.getAllByRole('img', {
        name: 'favorite-selected',
      });
      expect(favoriteStars.length).toBeGreaterThan(0);
    });
  });

  it('renders an "Import Chart" tooltip under import button', async () => {
    renderChartList();

    const importButton = await screen.findByTestId('import-button');
    fireEvent.mouseEnter(importButton);

    const importTooltip = await screen.findByRole('tooltip', {
      name: 'Import charts',
    });
    expect(importTooltip).toBeInTheDocument();
  });
});

describe('ChartList - anonymous view', () => {
  beforeEach(() => {
    fetchMock.resetHistory();
    // Reset favorite status for anonymous user
    fetchMock.get(
      chartFavoriteStatusEndpoint,
      {
        result: [],
      },
      { overwriteRoutes: true },
    );
  });

  it('does not show favorite stars for anonymous user', async () => {
    renderChartList({ user: {} });

    // Wait for list to load
    await screen.findByTestId('chart-list-view');

    // Switch to list view
    const listViewToggle = await screen.findByRole('img', {
      name: 'list-view',
    });
    const listViewButton = listViewToggle.closest('[role="button"]');
    fireEvent.click(listViewButton);

    // Wait for list view to be active and data to load
    await waitFor(() => {
      expect(screen.getByText('cool chart 0')).toBeInTheDocument();
    });

    // Verify no selected favorite stars are present
    await waitFor(() => {
      const favoriteStars = screen.queryAllByRole('img', {
        name: 'favorite-selected',
      });
      expect(favoriteStars).toHaveLength(0);
    });
  });
});
