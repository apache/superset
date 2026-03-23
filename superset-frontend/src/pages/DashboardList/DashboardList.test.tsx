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
import { isFeatureEnabled } from '@superset-ui/core';
import {
  screen,
  selectOption,
  waitFor,
  fireEvent,
} from 'spec/helpers/testing-library';
import {
  mockDashboards,
  mockAdminUser,
  setupMocks,
  renderDashboardList,
  API_ENDPOINTS,
  getLatestDashboardApiCall,
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

beforeEach(() => {
  setupMocks();
  mockIsFeatureEnabled.mockImplementation(
    (feature: string) => feature === 'LISTVIEWS_DEFAULT_CARD_VIEW',
  );
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  mockIsFeatureEnabled.mockReset();
});

test('renders', async () => {
  renderDashboardList(mockAdminUser);
  expect(await screen.findByText('Dashboards')).toBeInTheDocument();
});

test('renders a ListView', async () => {
  renderDashboardList(mockAdminUser);
  expect(await screen.findByTestId('dashboard-list-view')).toBeInTheDocument();
});

test('fetches info', async () => {
  renderDashboardList(mockAdminUser);
  await waitFor(() => {
    const calls = fetchMock.callHistory.calls(/dashboard\/_info/);
    expect(calls).toHaveLength(1);
  });
});

test('fetches data', async () => {
  renderDashboardList(mockAdminUser);
  await waitFor(() => {
    const calls = fetchMock.callHistory.calls(/dashboard\/\?q/);
    expect(calls).toHaveLength(1);
  });

  const calls = fetchMock.callHistory.calls(/dashboard\/\?q/);
  expect(calls[0].url).toMatchInlineSnapshot(
    `"http://localhost/api/v1/dashboard/?q=(order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:25,select_columns:!(id,dashboard_title,published,url,slug,changed_by,changed_by.id,changed_by.first_name,changed_by.last_name,changed_on_delta_humanized,owners,owners.id,owners.first_name,owners.last_name,editors.id,editors.label,editors.img,editors.type,tags.id,tags.name,tags.type,status,certified_by,certification_details,changed_on))"`,
  );
});

test('switches between card and table view', async () => {
  renderDashboardList(mockAdminUser);

  // Wait for the list to load
  await screen.findByTestId('dashboard-list-view');

  // Initially in card view (no table)
  expect(screen.queryByTestId('listview-table')).not.toBeInTheDocument();

  // Switch to table view via the list icon
  const listViewIcon = screen.getByRole('img', { name: 'unordered-list' });
  const listViewButton = listViewIcon.closest('[role="button"]')!;
  fireEvent.click(listViewButton);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // Switch back to card view
  const cardViewIcon = screen.getByRole('img', { name: 'appstore' });
  const cardViewButton = cardViewIcon.closest('[role="button"]')!;
  fireEvent.click(cardViewButton);

  await waitFor(() => {
    expect(screen.queryByTestId('listview-table')).not.toBeInTheDocument();
  });
});

test('shows edit modal', async () => {
  renderDashboardList(mockAdminUser);

  // Wait for data to load
  await screen.findByText(mockDashboards[0].dashboard_title);

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
  renderDashboardList(mockAdminUser);

  // Wait for data to load
  await screen.findByText(mockDashboards[0].dashboard_title);

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
  renderDashboardList(mockAdminUser);

  const importButton = await screen.findByTestId('import-button');
  fireEvent.mouseOver(importButton);

  expect(
    await screen.findByRole('tooltip', {
      name: 'Import dashboards',
    }),
  ).toBeInTheDocument();
});

test('renders all standard filters', async () => {
  renderDashboardList(mockAdminUser);
  await screen.findByTestId('dashboard-list-view');

  // Verify filter labels exist
  expect(screen.getByText('Editor')).toBeInTheDocument();
  expect(screen.getByText('Status')).toBeInTheDocument();
  expect(screen.getByText('Modified by')).toBeInTheDocument();
  expect(screen.getByText('Certified')).toBeInTheDocument();
});

test('selecting Status filter encodes published=true in API call', async () => {
  renderDashboardList(mockAdminUser);
  await screen.findByTestId('dashboard-list-view');

  await waitFor(() => {
    expect(
      screen.getByText(mockDashboards[0].dashboard_title),
    ).toBeInTheDocument();
  });

  await selectOption('Published', 'Status');

  await waitFor(() => {
    const latest = getLatestDashboardApiCall();
    expect(latest).not.toBeNull();
    expect(latest!.query!.filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          col: 'published',
          opr: 'eq',
          value: true,
        }),
      ]),
    );
  });
});

test('selecting Owner filter encodes rel_m_m owner in API call', async () => {
  // Replace the owners route to return a selectable option
  fetchMock.removeRoutes({
    names: [API_ENDPOINTS.DASHBOARD_RELATED_OWNERS, API_ENDPOINTS.CATCH_ALL],
  });
  fetchMock.get(
    API_ENDPOINTS.DASHBOARD_RELATED_OWNERS,
    { result: [{ value: 1, text: 'Admin User' }], count: 1 },
    { name: API_ENDPOINTS.DASHBOARD_RELATED_OWNERS },
  );
  fetchMock.get(API_ENDPOINTS.CATCH_ALL, (callLog: any) => {
    const reqUrl =
      typeof callLog === 'string' ? callLog : callLog?.url || callLog;
    throw new Error(`[fetchMock catch-all] Unmatched GET: ${reqUrl}`);
  });

  renderDashboardList(mockAdminUser);
  await screen.findByTestId('dashboard-list-view');

  await waitFor(() => {
    expect(
      screen.getByText(mockDashboards[0].dashboard_title),
    ).toBeInTheDocument();
  });

  await selectOption('Admin User', 'Editor');

  await waitFor(() => {
    const latest = getLatestDashboardApiCall();
    expect(latest).not.toBeNull();
    expect(latest!.query!.filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          col: 'owners',
          opr: 'rel_m_m',
          value: 1,
        }),
      ]),
    );
  });
});

test('selecting Modified by filter encodes rel_o_m changed_by in API call', async () => {
  // Replace the changed_by route to return a selectable option
  fetchMock.removeRoutes({
    names: [
      API_ENDPOINTS.DASHBOARD_RELATED_CHANGED_BY,
      API_ENDPOINTS.CATCH_ALL,
    ],
  });
  fetchMock.get(
    API_ENDPOINTS.DASHBOARD_RELATED_CHANGED_BY,
    { result: [{ value: 1, text: 'Admin User' }], count: 1 },
    { name: API_ENDPOINTS.DASHBOARD_RELATED_CHANGED_BY },
  );
  fetchMock.get(API_ENDPOINTS.CATCH_ALL, (callLog: any) => {
    const reqUrl =
      typeof callLog === 'string' ? callLog : callLog?.url || callLog;
    throw new Error(`[fetchMock catch-all] Unmatched GET: ${reqUrl}`);
  });

  renderDashboardList(mockAdminUser);
  await screen.findByTestId('dashboard-list-view');

  await waitFor(() => {
    expect(
      screen.getByText(mockDashboards[0].dashboard_title),
    ).toBeInTheDocument();
  });

  await selectOption('Admin User', 'Modified by');

  await waitFor(() => {
    const latest = getLatestDashboardApiCall();
    expect(latest).not.toBeNull();
    expect(latest!.query!.filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          col: 'changed_by',
          opr: 'rel_o_m',
          value: 1,
        }),
      ]),
    );
  });
});
