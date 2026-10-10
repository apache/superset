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
import {
  fireEvent,
  screen,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { isFeatureEnabled } from '@superset-ui/core';
import {
  mockDashboards,
  mockHandleResourceExport,
  setupMocks,
  renderDashboardList,
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
  mockHandleResourceExport.mockClear();
  setupMocks();
  // Default to list view (no card view feature flag)
  mockIsFeatureEnabled.mockReturnValue(false);
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  mockIsFeatureEnabled.mockReset();
});

test('renders table in list view', async () => {
  renderDashboardList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('dashboard-list-view')).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  expect(screen.queryByTestId('styled-card')).not.toBeInTheDocument();
});

test('renders all required column headers', async () => {
  renderDashboardList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');

  const expectedHeaders = [
    'Name',
    'Status',
    'Editors',
    'Last modified',
    'Actions',
  ];

  expectedHeaders.forEach(headerText => {
    expect(within(table).getByTitle(headerText)).toBeInTheDocument();
  });
});

test('displays dashboard data in table rows', async () => {
  renderDashboardList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const testDashboard = mockDashboards[0];

  await waitFor(() => {
    expect(
      within(table).getByText(testDashboard.dashboard_title),
    ).toBeInTheDocument();
  });

  // Find the specific row
  const dashboardNameElement = within(table).getByText(
    testDashboard.dashboard_title,
  );
  const dashboardRow = dashboardNameElement.closest(
    '[data-test="table-row"]',
  ) as HTMLElement;
  expect(dashboardRow).toBeInTheDocument();

  // Check for favorite star
  const favoriteButton = within(dashboardRow).getByTestId('fave-unfave-icon');
  expect(favoriteButton).toBeInTheDocument();

  // Check last modified time
  expect(
    within(dashboardRow).getByText(testDashboard.changed_on_delta_humanized),
  ).toBeInTheDocument();

  // Verify action buttons exist
  expect(within(dashboardRow).getByTestId('edit-alt')).toBeInTheDocument();
});

test('sorts table when clicking column header', async () => {
  renderDashboardList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const nameHeader = within(table).getByTitle('Name');
  await userEvent.click(nameHeader);

  await waitFor(() => {
    const latest = getLatestDashboardApiCall();
    expect(latest).not.toBeNull();
    expect(latest!.query).toMatchObject({
      order_column: 'dashboard_title',
      order_direction: 'asc',
    });
  });
});

test('supports bulk select and deselect all', async () => {
  renderDashboardList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(
      screen.getByText(mockDashboards[0].dashboard_title),
    ).toBeInTheDocument();
  });

  const bulkSelectButton = screen.getByTestId('bulk-select');
  await userEvent.click(bulkSelectButton);

  await waitFor(() => {
    expect(screen.getAllByRole('checkbox')).toHaveLength(
      mockDashboards.length + 1,
    );
  });

  // Select all
  const selectAllCheckbox = screen.getAllByLabelText('Select all')[0];
  expect(selectAllCheckbox).not.toBeChecked();
  await userEvent.click(selectAllCheckbox);

  await waitFor(() => {
    expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
      `${mockDashboards.length} Selected`,
    );
  });

  // Verify Delete and Export buttons appear
  const bulkActions = screen.getAllByTestId('bulk-select-action');
  expect(bulkActions.find(btn => btn.textContent === 'Delete')).toBeTruthy();
  expect(bulkActions.find(btn => btn.textContent === 'Export')).toBeTruthy();

  // Deselect all
  const deselectAllButton = screen.getByTestId('bulk-select-deselect-all');
  await userEvent.click(deselectAllButton);

  await waitFor(() => {
    expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
      '0 Selected',
    );
  });

  // Bulk action buttons should disappear
  expect(screen.queryByTestId('bulk-select-action')).not.toBeInTheDocument();
});

test('supports bulk export of selected dashboards', async () => {
  renderDashboardList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(
      screen.getByText(mockDashboards[0].dashboard_title),
    ).toBeInTheDocument();
  });

  const bulkSelectButton = screen.getByTestId('bulk-select');
  await userEvent.click(bulkSelectButton);

  await waitFor(() => {
    expect(screen.getAllByRole('checkbox')).toHaveLength(
      mockDashboards.length + 1,
    );
  });

  const selectAllCheckbox = screen.getAllByLabelText('Select all')[0];
  await userEvent.click(selectAllCheckbox);

  await waitFor(() => {
    expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
      `${mockDashboards.length} Selected`,
    );
  });

  const bulkActions = screen.getAllByTestId('bulk-select-action');
  const exportButton = bulkActions.find(btn => btn.textContent === 'Export');
  expect(exportButton).toBeInTheDocument();
  await userEvent.click(exportButton!);

  await waitFor(() => {
    expect(mockHandleResourceExport).toHaveBeenCalledWith(
      'dashboard',
      mockDashboards.map(d => d.id),
      expect.any(Function),
    );
  });
});

test('supports bulk delete of selected dashboards', async () => {
  renderDashboardList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(
      screen.getByText(mockDashboards[0].dashboard_title),
    ).toBeInTheDocument();
  });

  const bulkSelectButton = screen.getByTestId('bulk-select');
  await userEvent.click(bulkSelectButton);

  await waitFor(() => {
    expect(screen.getAllByRole('checkbox')).toHaveLength(
      mockDashboards.length + 1,
    );
  });

  const selectAllCheckbox = screen.getAllByLabelText('Select all')[0];
  await userEvent.click(selectAllCheckbox);

  await waitFor(() => {
    expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
      `${mockDashboards.length} Selected`,
    );
  });

  const bulkActions = screen.getAllByTestId('bulk-select-action');
  const deleteButton = bulkActions.find(btn => btn.textContent === 'Delete');
  expect(deleteButton).toBeInTheDocument();
  await userEvent.click(deleteButton!);

  await waitFor(() => {
    const deleteModal = screen.getByRole('dialog');
    expect(deleteModal).toBeInTheDocument();
    expect(deleteModal).toHaveTextContent(/delete/i);
    expect(deleteModal).toHaveTextContent(/selected dashboards/i);
  });

  // Type DELETE in the confirmation input
  const deleteInput = screen.getByTestId('delete-modal-input');
  await userEvent.type(deleteInput, 'DELETE');

  // Mock the bulk DELETE endpoint
  fetchMock.delete('glob:*/api/v1/dashboard/?*', {
    message: 'Dashboards deleted',
  });

  // Click confirm button
  const confirmButton = screen.getByTestId('modal-confirm-button');
  fireEvent.click(confirmButton);

  // Verify bulk delete API was called
  await waitFor(() => {
    const deleteCalls = fetchMock.callHistory.calls(/api\/v1\/dashboard\/\?/, {
      method: 'DELETE',
    });
    expect(deleteCalls).toHaveLength(1);
  });
});

test('displays certified badge only for certified dashboards', async () => {
  renderDashboardList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(
      screen.getByText(mockDashboards[0].dashboard_title),
    ).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');

  // mockDashboards[0] is certified (certified_by: 'Data Team')
  const certifiedRow = within(table)
    .getByText(mockDashboards[0].dashboard_title)
    .closest('[data-test="table-row"]') as HTMLElement;
  expect(within(certifiedRow).getByLabelText('certified')).toBeInTheDocument();

  // mockDashboards[1] is not certified (certified_by: null)
  const uncertifiedRow = within(table)
    .getByText(mockDashboards[1].dashboard_title)
    .closest('[data-test="table-row"]') as HTMLElement;
  expect(
    within(uncertifiedRow).queryByLabelText('certified'),
  ).not.toBeInTheDocument();
});

test('exits bulk select on button toggle', async () => {
  renderDashboardList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(
      screen.getByText(mockDashboards[0].dashboard_title),
    ).toBeInTheDocument();
  });

  const bulkSelectButton = screen.getByTestId('bulk-select');
  await userEvent.click(bulkSelectButton);

  await waitFor(() => {
    expect(screen.getAllByRole('checkbox')).toHaveLength(
      mockDashboards.length + 1,
    );
  });

  const table = screen.getByTestId('listview-table');
  const dataRows = within(table).getAllByTestId('table-row');
  const firstRowCheckbox = within(dataRows[0]).getByRole('checkbox');
  await userEvent.click(firstRowCheckbox);

  await waitFor(() => {
    expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
      '1 Selected',
    );
  });

  await userEvent.click(bulkSelectButton);

  await waitFor(() => {
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByTestId('bulk-select-copy')).not.toBeInTheDocument();
  });
});
