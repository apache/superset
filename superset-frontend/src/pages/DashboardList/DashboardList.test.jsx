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
import fetchMock from 'fetch-mock';
import * as reactRedux from 'react-redux';
import * as uiCore from '@superset-ui/core';

import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { styledMount as mount } from 'spec/helpers/theming';
import { render, screen, cleanup } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { QueryParamProvider } from 'use-query-params';
import { act } from 'react-dom/test-utils';

import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import DashboardList from 'src/pages/DashboardList';
import ListView from 'src/components/ListView';
import ListViewCard from 'src/components/ListViewCard';
import PropertiesModal from 'src/dashboard/components/PropertiesModal';
import FaveStar from 'src/components/FaveStar';
import TableCollection from 'src/components/TableCollection';
import CardCollection from 'src/components/ListView/CardCollection';

const dashboardsInfoEndpoint = 'glob:*/api/v1/dashboard/_info*';
const dashboardOwnersEndpoint = 'glob:*/api/v1/dashboard/related/owners*';
const dashboardCreatedByEndpoint =
  'glob:*/api/v1/dashboard/related/created_by*';
const dashboardFavoriteStatusEndpoint =
  'glob:*/api/v1/dashboard/favorite_status*';
const dashboardsEndpoint = 'glob:*/api/v1/dashboard/?*';
const dashboardEndpoint = 'glob:*/api/v1/dashboard/*';

const mockDashboards = [...new Array(3)].map((_, i) => ({
  id: i,
  url: 'url',
  dashboard_title: `title ${i}`,
  changed_by_name: 'user',
  changed_by_fk: 1,
  published: true,
  changed_on_utc: new Date().toISOString(),
  changed_on_delta_humanized: '5 minutes ago',
  owners: [{ id: 1, first_name: 'admin', last_name: 'admin_user' }],
  roles: [{ id: 1, name: 'adminUser' }],
  thumbnail_url: '/thumbnail',
}));

const mockUser = {
  userId: 1,
};

fetchMock.get(dashboardsInfoEndpoint, {
  permissions: ['can_read', 'can_write'],
});
fetchMock.get(dashboardOwnersEndpoint, {
  result: [],
});
fetchMock.get(dashboardCreatedByEndpoint, {
  result: [],
});
fetchMock.get(dashboardFavoriteStatusEndpoint, {
  result: [],
});

fetchMock.get(dashboardsEndpoint, {
  result: mockDashboards,
  dashboard_count: 3,
});

fetchMock.get(dashboardEndpoint, {
  result: mockDashboards[0],
});

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

// store needed for withToasts(DatabaseList)
const mockStore = configureStore([thunk]);
const store = mockStore({ user });
const useSelectorMock = jest.spyOn(reactRedux, 'useSelector');

describe('DashboardList', () => {
  const isFeatureEnabledMock = jest
    .spyOn(uiCore, 'isFeatureEnabled')
    .mockImplementation(feature => feature === 'LISTVIEWS_DEFAULT_CARD_VIEW');

  afterAll(() => {
    isFeatureEnabledMock.mockRestore();
  });

  beforeEach(() => {
    // setup a DOM element as a render target
    useSelectorMock.mockClear();
  });

  const mockedProps = {};
  let wrapper;

  beforeAll(async () => {
    fetchMock.resetHistory();
    wrapper = mount(
      <MemoryRouter>
        <reactRedux.Provider store={store}>
          <DashboardList {...mockedProps} user={mockUser} />
        </reactRedux.Provider>
      </MemoryRouter>,
    );

    await waitForComponentToPaint(wrapper);
  });

  it('renders', () => {
    expect(wrapper.find(DashboardList)).toExist();
  });

  it('renders a ListView', () => {
    expect(wrapper.find(ListView)).toExist();
  });

  it('fetches info', () => {
    const callsI = fetchMock.calls(/dashboard\/_info/);
    expect(callsI).toHaveLength(1);
  });

  it('fetches data', () => {
    wrapper.update();
    const callsD = fetchMock.calls(/dashboard\/\?q/);
    expect(callsD).toHaveLength(1);
    expect(callsD[0][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/dashboard/?q=(order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:25,select_columns:!(id,dashboard_title,published,url,slug,changed_by,changed_by.id,changed_by.first_name,changed_by.last_name,changed_on_delta_humanized,owners,owners.id,owners.first_name,owners.last_name,tags.id,tags.name,tags.type,status,certified_by,certification_details,changed_on))"`,
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

  it('card view edits', async () => {
    wrapper.find('[data-test="edit-alt"]').last().simulate('click');
    await waitForComponentToPaint(wrapper);
    expect(wrapper.find(PropertiesModal)).toExist();
  });

  it('delete', async () => {
    wrapper
      .find('[data-test="dashboard-list-trash-icon"]')
      .first()
      .simulate('click');
    await waitForComponentToPaint(wrapper);
    expect(wrapper.find(ConfirmStatusChange)).toExist();
  });

  it('card view delete', async () => {
    wrapper
      .find('[data-test="dashboard-list-trash-icon"]')
      .last()
      .simulate('click');
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
        <MemoryRouter>
          <QueryParamProvider>
            <DashboardList {...mockedProps} user={mockUser} />
          </QueryParamProvider>
        </MemoryRouter>,
        { useRedux: true },
      );
    });

    return mounted;
  }

  let isFeatureEnabledMock;
  beforeEach(async () => {
    isFeatureEnabledMock = jest
      .spyOn(uiCore, 'isFeatureEnabled')
      .mockImplementation(() => true);
    await renderAndWait();
  });

  afterEach(() => {
    cleanup();
    isFeatureEnabledMock.mockRestore();
  });

  it('renders an "Import Dashboard" tooltip under import button', async () => {
    const importButton = await screen.findByTestId('import-button');
    userEvent.hover(importButton);

    await screen.findByRole('tooltip');
    const importTooltip = screen.getByRole('tooltip', {
      name: 'Import dashboards',
    });

    expect(importTooltip).toBeInTheDocument();
  });
});

describe('DashboardList - anonymous view', () => {
  const mockedProps = {};
  const mockUserLoggedOut = {};
  let wrapper;

  beforeAll(async () => {
    fetchMock.resetHistory();
    wrapper = mount(
      <MemoryRouter>
        <reactRedux.Provider store={store}>
          <DashboardList {...mockedProps} user={mockUserLoggedOut} />
        </reactRedux.Provider>
      </MemoryRouter>,
    );

    await waitForComponentToPaint(wrapper);
  });

  afterAll(() => {
    cleanup();
    fetchMock.reset();
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
