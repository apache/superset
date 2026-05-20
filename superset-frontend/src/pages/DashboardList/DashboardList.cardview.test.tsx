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
  renderDashboardList,
  setupMocks,
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

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('DashboardList Card View Tests', () => {
  beforeEach(() => {
    setupMocks();

    // Enable card view as default
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockImplementation(
      (feature: string) => feature === 'LISTVIEWS_DEFAULT_CARD_VIEW',
    );
  });

  afterEach(() => fetchMock.clearHistory().removeRoutes());

  test('renders cards instead of table', async () => {
    renderDashboardList(mockUser);

    await screen.findByTestId('dashboard-list-view');

    // Verify no table in card view
    expect(screen.queryByTestId('listview-table')).not.toBeInTheDocument();

    // Verify card view toggle is active
    const cardViewToggle = screen.getByRole('img', { name: 'appstore' });
    const cardViewButton = cardViewToggle.closest('[role="button"]');
    expect(cardViewButton).toHaveClass('active');
  });

  test('switches from card view to list view', async () => {
    renderDashboardList(mockUser);
    await screen.findByTestId('dashboard-list-view');

    expect(screen.queryByTestId('listview-table')).not.toBeInTheDocument();

    // Switch to list view
    const listViewToggle = screen.getByRole('img', {
      name: 'unordered-list',
    });
    const listViewButton = listViewToggle.closest('[role="button"]');
    expect(listViewButton).not.toBeNull();
    fireEvent.click(listViewButton!);

    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });
  });

  test('displays dashboard data correctly in cards', async () => {
    renderDashboardList(mockUser);

    await screen.findByTestId('dashboard-list-view');

    await waitFor(() => {
      expect(
        screen.getByText(mockDashboards[0].dashboard_title),
      ).toBeInTheDocument();
    });

    // Verify favorite stars exist (one per dashboard)
    const favoriteStars = screen.getAllByTestId('fave-unfave-icon');
    expect(favoriteStars).toHaveLength(mockDashboards.length);

    // Verify action menu exists (more button for each card)
    const moreButtons = screen.getAllByLabelText('more');
    expect(moreButtons).toHaveLength(mockDashboards.length);

    // Verify menu items appear on click
    fireEvent.click(moreButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  test('renders sort dropdown in card view', async () => {
    renderDashboardList(mockUser);
    await screen.findByTestId('dashboard-list-view');

    await waitFor(() => {
      expect(screen.queryByTestId('listview-table')).not.toBeInTheDocument();
    });

    const sortFilter = screen.getByTestId('card-sort-select');
    expect(sortFilter).toBeInTheDocument();
    expect(sortFilter).toBeVisible();
  });

  test('selecting a sort option triggers new API call', async () => {
    renderDashboardList(mockUser);
    await screen.findByTestId('dashboard-list-view');

    await waitFor(() => {
      expect(
        screen.getByText(mockDashboards[0].dashboard_title),
      ).toBeInTheDocument();
    });

    // Find the sort select by its testId, then the combobox within it
    const sortContainer = screen.getByTestId('card-sort-select');
    const sortCombobox = within(sortContainer).getByRole('combobox');
    await userEvent.click(sortCombobox);

    // Select "Alphabetical" from the dropdown
    const alphabeticalOption = await waitFor(() =>
      within(
        // eslint-disable-next-line testing-library/no-node-access
        document.querySelector('.rc-virtual-list')!,
      ).getByText('Alphabetical'),
    );
    await userEvent.click(alphabeticalOption);

    await waitFor(() => {
      const latest = getLatestDashboardApiCall();
      expect(latest).not.toBeNull();
      expect(latest!.query).toMatchObject({
        order_column: 'dashboard_title',
        order_direction: 'asc',
      });
    });
  });

  test('can bulk deselect all dashboards', async () => {
    renderDashboardList(mockUser);

    await screen.findByTestId('dashboard-list-view');
    await waitFor(() => {
      expect(
        screen.getByText(mockDashboards[0].dashboard_title),
      ).toBeInTheDocument();
    });

    // Enable bulk select mode
    const bulkSelectButton = screen.getByTestId('bulk-select');
    fireEvent.click(bulkSelectButton);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-controls')).toBeInTheDocument();
    });

    // Select first card
    const firstDashboardName = screen.getByText(
      mockDashboards[0].dashboard_title,
    );
    fireEvent.click(firstDashboardName);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        '1 Selected',
      );
    });

    // Select second card
    const secondDashboardName = screen.getByText(
      mockDashboards[1].dashboard_title,
    );
    fireEvent.click(secondDashboardName);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        '2 Selected',
      );
    });

    // Verify Delete and Export buttons appear
    const bulkActions = screen.getAllByTestId('bulk-select-action');
    expect(bulkActions.find(btn => btn.textContent === 'Delete')).toBeTruthy();
    expect(bulkActions.find(btn => btn.textContent === 'Export')).toBeTruthy();

    // Click deselect all
    const deselectAllButton = screen.getByTestId('bulk-select-deselect-all');
    fireEvent.click(deselectAllButton);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        '0 Selected',
      );
    });

    // Bulk action buttons should disappear
    expect(screen.queryByTestId('bulk-select-action')).not.toBeInTheDocument();
  });

  test('can bulk export selected dashboards', async () => {
    renderDashboardList(mockUser);

    await screen.findByTestId('dashboard-list-view');
    await waitFor(() => {
      expect(
        screen.getByText(mockDashboards[0].dashboard_title),
      ).toBeInTheDocument();
    });

    // Enable bulk select mode
    const bulkSelectButton = screen.getByTestId('bulk-select');
    fireEvent.click(bulkSelectButton);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-controls')).toBeInTheDocument();
    });

    // Select dashboards by clicking on each card
    for (let i = 0; i < mockDashboards.length; i += 1) {
      const dashboardName = screen.getByText(mockDashboards[i].dashboard_title);
      fireEvent.click(dashboardName);
    }

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        `${mockDashboards.length} Selected`,
      );
    });

    const bulkExportButton = screen.getByText('Export');
    fireEvent.click(bulkExportButton);

    expect(mockHandleResourceExport).toHaveBeenCalledWith(
      'dashboard',
      mockDashboards.map(d => d.id),
      expect.any(Function),
    );
  });

  test('can bulk delete selected dashboards', async () => {
    renderDashboardList(mockUser);

    await screen.findByTestId('dashboard-list-view');
    await waitFor(() => {
      expect(
        screen.getByText(mockDashboards[0].dashboard_title),
      ).toBeInTheDocument();
    });

    // Enable bulk select mode
    const bulkSelectButton = screen.getByTestId('bulk-select');
    fireEvent.click(bulkSelectButton);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-controls')).toBeInTheDocument();
    });

    // Select dashboards
    for (let i = 0; i < mockDashboards.length; i += 1) {
      const dashboardName = screen.getByText(mockDashboards[i].dashboard_title);
      fireEvent.click(dashboardName);
    }

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        `${mockDashboards.length} Selected`,
      );
    });

    const bulkDeleteButton = screen.getByText('Delete');
    fireEvent.click(bulkDeleteButton);

    await waitFor(() => {
      expect(screen.getByText('Please confirm')).toBeInTheDocument();
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
      const deleteCalls = fetchMock.callHistory.calls(
        /api\/v1\/dashboard\/\?/,
        { method: 'DELETE' },
      );
      expect(deleteCalls).toHaveLength(1);
    });
  });

  test('exit bulk select by hitting x on bulk select bar', async () => {
    renderDashboardList(mockUser);

    await screen.findByTestId('dashboard-list-view');
    await waitFor(() => {
      expect(
        screen.getByText(mockDashboards[0].dashboard_title),
      ).toBeInTheDocument();
    });

    const bulkSelectButton = screen.getByTestId('bulk-select');
    fireEvent.click(bulkSelectButton);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-controls')).toBeInTheDocument();
    });

    // Click the X button to close bulk select
    const bulkSelectBar = screen.getByTestId('bulk-select-controls');
    const closeButton = within(bulkSelectBar).getByRole('button', {
      name: /close/i,
    });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(
        screen.queryByTestId('bulk-select-controls'),
      ).not.toBeInTheDocument();
    });
  });

  test('card click behavior changes in bulk select mode', async () => {
    renderDashboardList(mockUser);

    await screen.findByTestId('dashboard-list-view');
    await waitFor(() => {
      expect(
        screen.getByText(mockDashboards[0].dashboard_title),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByTestId('bulk-select-controls'),
    ).not.toBeInTheDocument();

    const bulkSelectButton = screen.getByTestId('bulk-select');
    fireEvent.click(bulkSelectButton);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-controls')).toBeInTheDocument();
    });

    // Clicking on cards should select them
    const firstDashboardName = screen.getByText(
      mockDashboards[0].dashboard_title,
    );
    fireEvent.click(firstDashboardName);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        '1 Selected',
      );
    });

    // Clicking the same card again should deselect it
    fireEvent.click(firstDashboardName);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        '0 Selected',
      );
    });
  });
});
