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
import fetchMock from 'fetch-mock';
import { fireEvent, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { isFeatureEnabled } from '@superset-ui/core';
import {
  API_ENDPOINTS,
  mockDashboards,
  setupMocks,
  renderDashboardList,
} from './DashboardList.testHelpers';

jest.setTimeout(30000);

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

jest.mock('src/utils/export', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockIsFeatureEnabled = isFeatureEnabled as jest.MockedFunction<
  typeof isFeatureEnabled
>;

const mockUser = {
  userId: 1,
  firstName: 'Test',
  lastName: 'User',
  roles: {
    Admin: [
      ['can_write', 'Dashboard'],
      ['can_export', 'Dashboard'],
    ],
  },
};

beforeEach(() => {
  setupMocks();
  // Default to card view for behavior tests
  mockIsFeatureEnabled.mockImplementation(
    (feature: string) => feature === 'LISTVIEWS_DEFAULT_CARD_VIEW',
  );
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  mockIsFeatureEnabled.mockReset();
});

test('can favorite a dashboard', async () => {
  // Mock favorite status - dashboard 1 is not favorited
  fetchMock.removeRoutes({
    names: ['glob:*/api/v1/dashboard/favorite_status*'],
  });
  fetchMock.get('glob:*/api/v1/dashboard/favorite_status*', {
    result: mockDashboards.map(d => ({
      id: d.id,
      value: false,
    })),
  });

  // Mock the POST to favorite endpoint
  fetchMock.post('glob:*/api/v1/dashboard/*/favorites/', {
    result: 'OK',
  });

  renderDashboardList(mockUser);

  await waitFor(() => {
    expect(
      screen.getByText(mockDashboards[0].dashboard_title),
    ).toBeInTheDocument();
  });

  // Find and click an unstarred favorite icon
  const favoriteIcons = screen.getAllByTestId('fave-unfave-icon');
  expect(favoriteIcons.length).toBeGreaterThan(0);
  fireEvent.click(favoriteIcons[0]);

  // Verify POST was made to favorites endpoint
  await waitFor(() => {
    const favCalls = fetchMock.callHistory.calls(/dashboard\/\d+\/favorites/, {
      method: 'POST',
    });
    expect(favCalls).toHaveLength(1);
  });

  // Verify the star icon flipped to starred state
  await waitFor(() => {
    expect(screen.getByRole('img', { name: 'starred' })).toBeInTheDocument();
  });
});

test('can unfavorite a dashboard', async () => {
  // Clear all routes and re-setup with favorited dashboard
  fetchMock.clearHistory().removeRoutes();

  // Setup mocks manually with dashboard 1 favorited
  fetchMock.get('glob:*/api/v1/dashboard/_info*', {
    permissions: ['can_read', 'can_write', 'can_export'],
  });
  fetchMock.get('glob:*/api/v1/dashboard/?*', {
    result: mockDashboards,
    dashboard_count: mockDashboards.length,
  });
  fetchMock.get('glob:*/api/v1/dashboard/favorite_status*', {
    result: mockDashboards.map(d => ({
      id: d.id,
      value: d.id === 1,
    })),
  });
  fetchMock.get('glob:*/api/v1/dashboard/related/owners*', {
    result: [],
    count: 0,
  });
  fetchMock.get('glob:*/api/v1/dashboard/related/changed_by*', {
    result: [],
    count: 0,
  });
  global.URL.createObjectURL = jest.fn();
  fetchMock.get('/thumbnail', { body: new Blob(), sendAsJson: false });
  fetchMock.get('glob:*', (callLog: any) => {
    const reqUrl =
      typeof callLog === 'string' ? callLog : callLog?.url || callLog;
    throw new Error(`[fetchMock catch-all] Unmatched GET: ${reqUrl}`);
  });

  // Mock the DELETE to unfavorite endpoint
  fetchMock.delete('glob:*/api/v1/dashboard/*/favorites/', {
    result: 'OK',
  });

  renderDashboardList(mockUser);

  await waitFor(() => {
    expect(
      screen.getByText(mockDashboards[0].dashboard_title),
    ).toBeInTheDocument();
  });

  // Wait for the starred icon to appear (favorite status loaded)
  const starredIcon = await screen.findByRole('img', { name: 'starred' });
  fireEvent.click(starredIcon);

  // Verify DELETE was made to favorites endpoint
  await waitFor(() => {
    const unfavCalls = fetchMock.callHistory.calls(
      /dashboard\/\d+\/favorites/,
      { method: 'DELETE' },
    );
    expect(unfavCalls).toHaveLength(1);
  });

  // Verify the star icon flipped back to unstarred state
  await waitFor(() => {
    expect(
      screen.queryByRole('img', { name: 'starred' }),
    ).not.toBeInTheDocument();
  });
});

test('can delete a single dashboard from card menu', async () => {
  renderDashboardList(mockUser);

  await waitFor(() => {
    expect(
      screen.getByText(mockDashboards[0].dashboard_title),
    ).toBeInTheDocument();
  });

  // Open card menu
  const moreButtons = screen.getAllByLabelText('more');
  fireEvent.click(moreButtons[0]);

  // Click delete from the dropdown
  const deleteButton = await screen.findByTestId(
    'dashboard-card-option-delete-button',
  );
  fireEvent.click(deleteButton);

  // Should open delete confirmation dialog
  await waitFor(() => {
    expect(
      screen.getByText(/Are you sure you want to delete/i),
    ).toBeInTheDocument();
  });

  // Type DELETE in the confirmation input
  const deleteInput = screen.getByTestId('delete-modal-input');
  await userEvent.type(deleteInput, 'DELETE');

  // Mock the DELETE endpoint
  fetchMock.delete('glob:*/api/v1/dashboard/*', {
    message: 'Dashboard deleted',
  });

  // Click confirm button
  const confirmButton = screen.getByTestId('modal-confirm-button');
  fireEvent.click(confirmButton);

  // Verify delete API was called
  await waitFor(() => {
    const deleteCalls = fetchMock.callHistory.calls(/api\/v1\/dashboard\//, {
      method: 'DELETE',
    });
    expect(deleteCalls).toHaveLength(1);
  });

  // Verify the delete confirmation dialog closes
  await waitFor(() => {
    expect(
      screen.queryByText(/Are you sure you want to delete/i),
    ).not.toBeInTheDocument();
  });
});

test('can edit dashboard title via properties modal', async () => {
  // Clear all routes and re-setup with single dashboard mock
  fetchMock.clearHistory().removeRoutes();

  fetchMock.get(API_ENDPOINTS.DASHBOARDS_INFO, {
    permissions: ['can_read', 'can_write', 'can_export'],
  });
  fetchMock.get(API_ENDPOINTS.DASHBOARDS, {
    result: mockDashboards,
    dashboard_count: mockDashboards.length,
  });
  fetchMock.get(API_ENDPOINTS.DASHBOARD_FAVORITE_STATUS, { result: [] });
  fetchMock.get(API_ENDPOINTS.DASHBOARD_RELATED_OWNERS, {
    result: [],
    count: 0,
  });
  fetchMock.get(API_ENDPOINTS.DASHBOARD_RELATED_CHANGED_BY, {
    result: [],
    count: 0,
  });
  global.URL.createObjectURL = jest.fn();
  fetchMock.get(API_ENDPOINTS.THUMBNAIL, {
    body: new Blob(),
    sendAsJson: false,
  });

  // Mock GET for single dashboard (PropertiesModal fetches /api/v1/dashboard/<id>)
  fetchMock.get(/\/api\/v1\/dashboard\/\d+$/, {
    result: {
      ...mockDashboards[0],
      json_metadata: '{}',
      slug: '',
      css: '',
      is_managed_externally: false,
      metadata: {},
      theme: null,
    },
  });

  // Mock themes endpoint (PropertiesModal fetches available themes)
  fetchMock.get('glob:*/api/v1/theme/*', { result: [] });

  // Catch-all must be last — fail hard on unmatched URLs
  fetchMock.get(API_ENDPOINTS.CATCH_ALL, (callLog: any) => {
    const reqUrl =
      typeof callLog === 'string' ? callLog : callLog?.url || callLog;
    throw new Error(`[fetchMock catch-all] Unmatched GET: ${reqUrl}`);
  });

  renderDashboardList(mockUser);

  await waitFor(() => {
    expect(
      screen.getByText(mockDashboards[0].dashboard_title),
    ).toBeInTheDocument();
  });

  // Open card menu and click edit
  const moreButtons = screen.getAllByLabelText('more');
  fireEvent.click(moreButtons[0]);

  const editButton = await screen.findByTestId(
    'dashboard-card-option-edit-button',
  );
  fireEvent.click(editButton);

  // Wait for properties modal to load and show the title input
  const titleInput = await screen.findByTestId('dashboard-title-input');
  expect(titleInput).toHaveValue(mockDashboards[0].dashboard_title);

  // Change the title
  await userEvent.clear(titleInput);
  await userEvent.type(titleInput, 'Updated Dashboard Title');

  // Mock the PUT endpoint
  fetchMock.put('glob:*/api/v1/dashboard/*', {
    result: {
      ...mockDashboards[0],
      dashboard_title: 'Updated Dashboard Title',
    },
  });

  // Click Save button
  const saveButton = screen.getByRole('button', { name: /save/i });
  fireEvent.click(saveButton);

  // Verify PUT API was called
  await waitFor(() => {
    const putCalls = fetchMock.callHistory.calls(/api\/v1\/dashboard\//, {
      method: 'PUT',
    });
    expect(putCalls).toHaveLength(1);
  });

  // Verify the properties modal closes after save
  await waitFor(() => {
    expect(
      screen.queryByTestId('dashboard-title-input'),
    ).not.toBeInTheDocument();
  });
});

test('opens delete confirmation from list view trash icon', async () => {
  // Switch to list view
  mockIsFeatureEnabled.mockReturnValue(false);

  renderDashboardList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(
      screen.getByText(mockDashboards[0].dashboard_title),
    ).toBeInTheDocument();
  });

  // Click the delete icon in the actions column
  const trashIcons = screen.getAllByTestId('dashboard-list-trash-icon');
  fireEvent.click(trashIcons[0]);

  // Should open confirmation dialog
  await waitFor(() => {
    expect(
      screen.getByText(/Are you sure you want to delete/i),
    ).toBeInTheDocument();
  });

  // Type DELETE in the confirmation input
  const deleteInput = screen.getByTestId('delete-modal-input');
  await userEvent.type(deleteInput, 'DELETE');

  // Mock the DELETE endpoint
  fetchMock.delete('glob:*/api/v1/dashboard/*', {
    message: 'Dashboard deleted',
  });

  // Click confirm button
  const confirmButton = screen.getByTestId('modal-confirm-button');
  fireEvent.click(confirmButton);

  // Verify delete API was called
  await waitFor(() => {
    const deleteCalls = fetchMock.callHistory.calls(/api\/v1\/dashboard\//, {
      method: 'DELETE',
    });
    expect(deleteCalls).toHaveLength(1);
  });

  // Verify the delete confirmation dialog closes
  await waitFor(() => {
    expect(
      screen.queryByText(/Are you sure you want to delete/i),
    ).not.toBeInTheDocument();
  });
});
