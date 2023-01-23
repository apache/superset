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
import { MemoryRouter } from 'react-router-dom';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import { Provider } from 'react-redux';
import fetchMock from 'fetch-mock';
import * as featureFlags from 'src/featureFlags';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { styledMount as mount } from 'spec/helpers/theming';
import { render, screen, cleanup } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { QueryParamProvider } from 'use-query-params';
import { act } from 'react-dom/test-utils';

import ChartList from 'src/pages/ChartList';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import ListView from 'src/components/ListView';
import PropertiesModal from 'src/explore/components/PropertiesModal';
import ListViewCard from 'src/components/ListViewCard';
import FaveStar from 'src/components/FaveStar';
import TableCollection from 'src/components/TableCollection';
import CardCollection from 'src/components/ListView/CardCollection';
// store needed for withToasts(ChartTable)
const mockStore = configureStore([thunk]);
const store = mockStore({});

const chartsInfoEndpoint = 'glob:*/api/v1/chart/_info*';
const chartsOwnersEndpoint = 'glob:*/api/v1/chart/related/owners*';
const chartsCreatedByEndpoint = 'glob:*/api/v1/chart/related/created_by*';
const chartsEndpoint = 'glob:*/api/v1/chart/*';
const chartsVizTypesEndpoint = 'glob:*/api/v1/chart/viz_types';
const chartsDatasourcesEndpoint = 'glob:*/api/v1/chart/datasources';
const chartFavoriteStatusEndpoint = 'glob:*/api/v1/chart/favorite_status*';
const datasetEndpoint = 'glob:*/api/v1/dataset/*';

const mockCharts = [...new Array(3)].map((_, i) => ({
  changed_on: new Date().toISOString(),
  creator: 'super user',
  id: i,
  slice_name: `cool chart ${i}`,
  url: 'url',
  viz_type: 'bar',
  datasource_name: `ds${i}`,
  thumbnail_url: '/thumbnail',
}));

const mockUser = {
  userId: 1,
};

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
  result: [],
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

describe('ChartList', () => {
  const isFeatureEnabledMock = jest
    .spyOn(featureFlags, 'isFeatureEnabled')
    .mockImplementation(feature => feature === 'LISTVIEWS_DEFAULT_CARD_VIEW');

  afterAll(() => {
    isFeatureEnabledMock.restore();
  });
  const mockedProps = {};

  let wrapper;

  beforeAll(async () => {
    wrapper = mount(
      <MemoryRouter>
        <Provider store={store}>
          <ChartList {...mockedProps} user={mockUser} />
        </Provider>
      </MemoryRouter>,
    );

    await waitForComponentToPaint(wrapper);
  });

  it('renders', () => {
    expect(wrapper.find(ChartList)).toExist();
  });

  it('renders a ListView', () => {
    expect(wrapper.find(ListView)).toExist();
  });

  it('fetches info', () => {
    const callsI = fetchMock.calls(/chart\/_info/);
    expect(callsI).toHaveLength(1);
  });

  it('fetches data', () => {
    wrapper.update();
    const callsD = fetchMock.calls(/chart\/\?q/);
    expect(callsD).toHaveLength(1);
    expect(callsD[0][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/chart/?q=(order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:25)"`,
    );
  });

  it('renders a card view', () => {
    expect(wrapper.find(ListViewCard)).toExist();
  });

  it('renders a table view', async () => {
    wrapper.find('[aria-label="list-view"]').first().simulate('click');
    await waitForComponentToPaint(wrapper);
    expect(wrapper.find('table')).toExist();
  });

  it('edits', async () => {
    expect(wrapper.find(PropertiesModal)).not.toExist();
    wrapper.find('[data-test="edit-alt"]').first().simulate('click');
    await waitForComponentToPaint(wrapper);
    expect(wrapper.find(PropertiesModal)).toExist();
  });

  it('delete', async () => {
    wrapper.find('[data-test="trash"]').first().simulate('click');
    await waitForComponentToPaint(wrapper);
    expect(wrapper.find(ConfirmStatusChange)).toExist();
  });

  it('renders the Favorite Star column in list view for logged in user', async () => {
    wrapper.find('[aria-label="list-view"]').first().simulate('click');
    await waitForComponentToPaint(wrapper);
    expect(wrapper.find(TableCollection).find(FaveStar)).toExist();
  });

  it('renders the Favorite Star in card view for logged in user', async () => {
    wrapper.find('[aria-label="card-view"]').first().simulate('click');
    await waitForComponentToPaint(wrapper);
    expect(wrapper.find(CardCollection).find(FaveStar)).toExist();
  });
});

describe('RTL', () => {
  async function renderAndWait() {
    const mounted = act(async () => {
      const mockedProps = {};
      render(
        <QueryParamProvider>
          <ChartList {...mockedProps} user={mockUser} />
        </QueryParamProvider>,
        { useRedux: true, useRouter: true },
      );
    });

    return mounted;
  }

  let isFeatureEnabledMock;
  beforeEach(async () => {
    isFeatureEnabledMock = jest
      .spyOn(featureFlags, 'isFeatureEnabled')
      .mockImplementation(() => true);
    await renderAndWait();
  });

  afterEach(() => {
    cleanup();
    isFeatureEnabledMock.mockRestore();
  });

  it('renders an "Import Chart" tooltip under import button', async () => {
    const importButton = await screen.findByTestId('import-button');
    userEvent.hover(importButton);

    await screen.findByRole('tooltip');
    const importTooltip = screen.getByRole('tooltip', {
      name: 'Import charts',
    });

    expect(importTooltip).toBeInTheDocument();
  });
});

describe('ChartList - anonymous view', () => {
  const mockedProps = {};
  const mockUserLoggedOut = {};
  let wrapper;

  beforeAll(async () => {
    fetchMock.resetHistory();
    wrapper = mount(
      <MemoryRouter>
        <Provider store={store}>
          <ChartList {...mockedProps} user={mockUserLoggedOut} />
        </Provider>
      </MemoryRouter>,
    );

    await waitForComponentToPaint(wrapper);
  });

  afterAll(() => {
    cleanup();
    fetch.resetMocks();
  });

  it('does not render the Favorite Star column in list view for anonymous user', async () => {
    wrapper.find('[aria-label="list-view"]').first().simulate('click');
    await waitForComponentToPaint(wrapper);
    expect(wrapper.find(TableCollection).find(FaveStar)).not.toExist();
  });

  it('does not render the Favorite Star in card view for anonymous user', async () => {
    wrapper.find('[aria-label="card-view"]').first().simulate('click');
    await waitForComponentToPaint(wrapper);
    expect(wrapper.find(CardCollection).find(FaveStar)).not.toExist();
  });
});
