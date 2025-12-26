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
import fetchMock from 'fetch-mock';
import { isFeatureEnabled } from '@superset-ui/core';
import {
  render,
  screen,
  waitFor,
  fireEvent,
} from 'spec/helpers/testing-library';
import { QueryParamProvider } from 'use-query-params';

import DashboardList from 'src/pages/DashboardList';

const dashboardsInfoEndpoint = 'glob:*/api/v1/dashboard/_info*';
const dashboardOwnersEndpoint = 'glob:*/api/v1/dashboard/related/owners*';
const dashboardCreatedByEndpoint =
  'glob:*/api/v1/dashboard/related/created_by*';
const dashboardFavoriteStatusEndpoint =
  'glob:*/api/v1/dashboard/favorite_status*';
const dashboardsEndpoint = 'glob:*/api/v1/dashboard/?*';
const dashboardEndpoint = 'glob:*/api/v1/dashboard/*';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockDashboards = new Array(3).fill().map((_, i) => ({
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

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('DashboardList', () => {
  const renderDashboardList = (props = {}, userProp = mockUser) =>
    render(
      <MemoryRouter>
        <QueryParamProvider>
          <DashboardList {...props} user={userProp} />
        </QueryParamProvider>
      </MemoryRouter>,
      { useRedux: true },
    );

  beforeEach(() => {
    isFeatureEnabled.mockImplementation(
      feature => feature === 'LISTVIEWS_DEFAULT_CARD_VIEW',
    );
    fetchMock.resetHistory();
  });

  afterEach(() => {
    isFeatureEnabled.mockRestore();
  });

  test('renders', async () => {
    renderDashboardList();
    expect(await screen.findByText('Dashboards')).toBeInTheDocument();
  });

  test('renders a ListView', async () => {
    renderDashboardList();
    expect(
      await screen.findByTestId('dashboard-list-view'),
    ).toBeInTheDocument();
  });

  test('fetches info', async () => {
    renderDashboardList();
    await waitFor(() => {
      const calls = fetchMock.calls(/dashboard\/_info/);
      expect(calls).toHaveLength(1);
    });
  });

  test('fetches data', async () => {
    renderDashboardList();
    await waitFor(() => {
      const calls = fetchMock.calls(/dashboard\/\?q/);
      expect(calls).toHaveLength(1);
    });

    const calls = fetchMock.calls(/dashboard\/\?q/);
    expect(calls[0][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/dashboard/?q=(order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:25,select_columns:!(id,dashboard_title,published,url,slug,changed_by,changed_by.id,changed_by.first_name,changed_by.last_name,changed_on_delta_humanized,owners,owners.id,owners.first_name,owners.last_name,tags.id,tags.name,tags.type,status,certified_by,certification_details,changed_on))"`,
    );
  });

  test('switches between card and table view', async () => {
    renderDashboardList();

    // Wait for the list to load
    await screen.findByTestId('dashboard-list-view');

    // Initially in card view
    const cardViewIcon = screen.getByRole('img', { name: 'appstore' });
    expect(cardViewIcon).toBeInTheDocument();

    // Switch to table view
    const listViewIcon = screen.getByRole('img', { name: 'appstore' });
    const listViewButton = listViewIcon.closest('[role="button"]');
    fireEvent.click(listViewButton);

    // Switch back to card view
    const cardViewButton = cardViewIcon.closest('[role="button"]');
    fireEvent.click(cardViewButton);
  });

  test('shows edit modal', async () => {
    renderDashboardList();

    // Wait for data to load
    await screen.findByText('title 0');

    // Find and click the first more options button
    const moreIcons = await screen.findAllByRole('img', {
      name: 'more',
    });
    fireEvent.click(moreIcons[0]);

    // Click edit from the dropdown
    const editButton = await screen.findByTestId(
      'dashboard-card-option-edit-button',
    );
    fireEvent.click(editButton);

    // Check for modal
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  test('shows delete confirmation', async () => {
    renderDashboardList();

    // Wait for data to load
    await screen.findByText('title 0');

    // Find and click the first more options button
    const moreIcons = await screen.findAllByRole('img', {
      name: 'more',
    });
    fireEvent.click(moreIcons[0]);

    // Click delete from the dropdown
    const deleteButton = await screen.findByTestId(
      'dashboard-card-option-delete-button',
    );
    fireEvent.click(deleteButton);

    // Check for confirmation dialog
    expect(
      await screen.findByText(/Are you sure you want to delete/i),
    ).toBeInTheDocument();
  });

  test('renders an "Import Dashboard" tooltip', async () => {
    renderDashboardList();

    const importButton = await screen.findByTestId('import-button');
    fireEvent.mouseOver(importButton);

    expect(
      await screen.findByRole('tooltip', {
        name: 'Import dashboards',
      }),
    ).toBeInTheDocument();
  });
});

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('DashboardList - anonymous view', () => {
  test('does not render favorite stars for anonymous user', async () => {
    render(
      <MemoryRouter>
        <QueryParamProvider>
          <DashboardList user={{}} />
        </QueryParamProvider>
      </MemoryRouter>,
      { useRedux: true },
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('img', { name: /favorite/i }),
      ).not.toBeInTheDocument();
    });
  });
});

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('DashboardList - permissions', () => {
  const mockDashboardsWithDifferentOwners = [
    {
      id: 1,
      url: 'url',
      dashboard_title: 'Dashboard I Own',
      changed_by_name: 'user',
      changed_by: { first_name: 'user', last_name: 'one' },
      changed_by_fk: 1,
      published: true,
      status: 'published',
      changed_on_utc: new Date().toISOString(),
      changed_on_delta_humanized: '5 minutes ago',
      owners: [{ id: 1, first_name: 'admin', last_name: 'admin_user' }],
      roles: [{ id: 1, name: 'adminUser' }],
      thumbnail_url: '/thumbnail',
      tags: [],
    },
    {
      id: 2,
      url: 'url',
      dashboard_title: 'Dashboard I Do Not Own',
      changed_by_name: 'other_user',
      changed_by: { first_name: 'other', last_name: 'user' },
      changed_by_fk: 2,
      published: true,
      status: 'published',
      changed_on_utc: new Date().toISOString(),
      changed_on_delta_humanized: '10 minutes ago',
      owners: [{ id: 2, first_name: 'other', last_name: 'user' }],
      roles: [{ id: 2, name: 'regularUser' }],
      thumbnail_url: '/thumbnail',
      tags: [],
    },
  ];

  const renderDashboardListWithOwners = (userProp = { userId: 1 }) => {
    // Reset and setup fetch mocks
    fetchMock.get(dashboardsInfoEndpoint, {
      permissions: ['can_read', 'can_write', 'can_export'],
    }, { overwriteRoutes: true });

    fetchMock.get(dashboardFavoriteStatusEndpoint, {
      result: [],
    }, { overwriteRoutes: true });

    fetchMock.get(
      dashboardsEndpoint,
      {
        result: mockDashboardsWithDifferentOwners,
        dashboard_count: 2,
      },
      { overwriteRoutes: true },
    );

    return render(
      <MemoryRouter>
        <QueryParamProvider>
          <DashboardList user={userProp} />
        </QueryParamProvider>
      </MemoryRouter>,
      {
        useRedux: true,
        initialState: {
          user: {
            roles: {},  // Non-admin user
          },
        },
      },
    );
  };

  beforeEach(() => {
    isFeatureEnabled.mockImplementation(
      feature => feature === 'LISTVIEWS_DEFAULT_CARD_VIEW',
    );
    fetchMock.resetHistory();
  });

  afterEach(() => {
    isFeatureEnabled.mockRestore();
    fetchMock.restore();
  });

  test('shows enabled edit button for dashboard owner', async () => {
    renderDashboardListWithOwners();

    // Wait for data to load
    await screen.findByText('Dashboard I Own');

    // Switch to table view to see action buttons
    const tableViewButton = screen.getByRole('img', { name: 'unordered-list' });
    fireEvent.click(tableViewButton);

    // Find all edit icons
    const editButtons = await screen.findAllByRole('img', { name: /edit/i });
    const editButtonForOwnedDashboard = editButtons[0];

    // Check that the button is not disabled
    const editButtonSpan = editButtonForOwnedDashboard.closest('.action-button');
    expect(editButtonSpan).not.toHaveClass('disabled');

    // Check tooltip shows "Edit" for owned dashboard
    fireEvent.mouseOver(editButtonForOwnedDashboard);
    expect(
      await screen.findByRole('tooltip', { name: 'Edit' }),
    ).toBeInTheDocument();
  });

  test('shows disabled edit button with informative tooltip for non-owner', async () => {
    renderDashboardListWithOwners();

    // Wait for data to load
    await screen.findByText('Dashboard I Own');

    // Switch to table view to see action buttons
    const tableViewButton = screen.getByRole('img', { name: 'unordered-list' });
    fireEvent.click(tableViewButton);

    // Wait for table to render and find the non-owned dashboard row
    await screen.findByText('Dashboard I Do Not Own');

    // Find all edit buttons
    const editButtons = await screen.findAllByRole('img', { name: /edit/i });
    // Second dashboard (index 1) is the one we don't own
    const editButtonForNonOwnedDashboard = editButtons[1];

    // Check that the button has the disabled class
    const editButtonSpan = editButtonForNonOwnedDashboard.closest('.action-button');
    expect(editButtonSpan).toHaveClass('disabled');

    // Check tooltip shows permission message for non-owned dashboard
    fireEvent.mouseOver(editButtonForNonOwnedDashboard);
    expect(
      await screen.findByRole('tooltip', {
        name: /You must be a dashboard owner in order to edit/i,
      }),
    ).toBeInTheDocument();
  });

  test('shows enabled delete button for dashboard owner', async () => {
    renderDashboardListWithOwners();

    // Wait for data to load
    await screen.findByText('Dashboard I Own');

    // Switch to table view to see action buttons
    const tableViewButton = screen.getByRole('img', { name: 'unordered-list' });
    fireEvent.click(tableViewButton);

    // Find all delete buttons
    const deleteButtons = await screen.findAllByRole('img', { name: /delete/i });
    const deleteButtonForOwnedDashboard = deleteButtons[0];

    // Check that the button is not disabled
    const deleteButtonSpan = deleteButtonForOwnedDashboard.closest('.action-button');
    expect(deleteButtonSpan).not.toHaveClass('disabled');

    // Check tooltip shows "Delete" for owned dashboard
    fireEvent.mouseOver(deleteButtonForOwnedDashboard);
    expect(
      await screen.findByRole('tooltip', { name: 'Delete' }),
    ).toBeInTheDocument();
  });

  test('shows disabled delete button with informative tooltip for non-owner', async () => {
    renderDashboardListWithOwners();

    // Wait for data to load
    await screen.findByText('Dashboard I Own');

    // Switch to table view to see action buttons
    const tableViewButton = screen.getByRole('img', { name: 'unordered-list' });
    fireEvent.click(tableViewButton);

    // Wait for table to render and find the non-owned dashboard row
    await screen.findByText('Dashboard I Do Not Own');

    // Find all delete buttons
    const deleteButtons = await screen.findAllByRole('img', { name: /delete/i });
    // Second dashboard (index 1) is the one we don't own
    const deleteButtonForNonOwnedDashboard = deleteButtons[1];

    // Check that the button has the disabled class
    const deleteButtonSpan = deleteButtonForNonOwnedDashboard.closest('.action-button');
    expect(deleteButtonSpan).toHaveClass('disabled');

    // Check tooltip shows permission message for non-owned dashboard
    fireEvent.mouseOver(deleteButtonForNonOwnedDashboard);
    expect(
      await screen.findByRole('tooltip', {
        name: /You must be a dashboard owner in order to delete/i,
      }),
    ).toBeInTheDocument();
  });

  test('edit button does not trigger action when user is not owner', async () => {
    renderDashboardListWithOwners();

    // Wait for data to load
    await screen.findByText('Dashboard I Own');

    // Switch to table view to see action buttons
    const tableViewButton = screen.getByRole('img', { name: 'unordered-list' });
    fireEvent.click(tableViewButton);

    // Wait for table to render
    await screen.findByText('Dashboard I Do Not Own');

    // Find all edit buttons
    const editButtons = await screen.findAllByRole('img', { name: /edit/i });
    const editButtonForNonOwnedDashboard = editButtons[1];

    // Click the disabled edit button (clicking the parent span)
    const editButtonSpan = editButtonForNonOwnedDashboard.closest('.action-button');
    fireEvent.click(editButtonSpan);

    // Wait a bit to ensure no async actions are triggered
    await waitFor(() => {
      // Modal should not appear
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  test('delete button does not trigger confirmation when user is not owner', async () => {
    renderDashboardListWithOwners();

    // Wait for data to load
    await screen.findByText('Dashboard I Own');

    // Switch to table view to see action buttons
    const tableViewButton = screen.getByRole('img', { name: 'unordered-list' });
    fireEvent.click(tableViewButton);

    // Find all delete buttons
    const deleteButtons = await screen.findAllByRole('img', { name: /delete/i });
    const deleteButtonForNonOwnedDashboard = deleteButtons[1];

    // Click the disabled delete button
    fireEvent.click(deleteButtonForNonOwnedDashboard);

    // Wait a bit to ensure no async actions are triggered
    await waitFor(() => {
      // Confirmation dialog should not appear
      expect(
        screen.queryByText(/Are you sure you want to delete/i),
      ).not.toBeInTheDocument();
    });
  });
});
