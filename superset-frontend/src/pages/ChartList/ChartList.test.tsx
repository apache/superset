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
  screen,
  waitFor,
  fireEvent,
  within,
} from 'spec/helpers/testing-library';
import { isFeatureEnabled } from '@superset-ui/core';
import {
  API_ENDPOINTS,
  mockCharts,
  renderChartList,
  setupMocks,
} from './ChartList.testHelpers';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

// Increase default timeout for all tests
jest.setTimeout(30000);

const mockUser = {
  userId: 1,
  firstName: 'Test',
  lastName: 'User',
  roles: {
    Admin: [
      ['can_sqllab', 'Superset'],
      ['can_write', 'Dashboard'],
      ['can_write', 'Chart'],
      ['can_export', 'Chart'],
    ],
  },
};

// Filter utilities
const findFilterByLabel = (labelText: string) => {
  const containers = screen.getAllByTestId('select-filter-container');
  for (const container of containers) {
    // Compact pill filters show the label as button text
    const pill = container.querySelector(
      '[data-test="compact-filter-pill"]',
    ) as HTMLElement | null;
    if (pill && pill.textContent?.includes(labelText)) {
      return pill;
    }
  }
  return null;
};

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('ChartList', () => {
  beforeEach(() => {
    fetchMock.removeRoutes();
    setupMocks();
  });

  afterEach(() => {
    fetchMock.clearHistory();
    // Reset feature flag mock
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockReset();
  });

  test('renders component with basic structure', async () => {
    renderChartList(mockUser);

    expect(await screen.findByTestId('chart-list-view')).toBeInTheDocument();
    expect(screen.getByText('Charts')).toBeInTheDocument();
  });

  test('navigates to /chart/add on New Chart button click', async () => {
    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');

    // Verify New Chart button exists
    const newChartButton = screen.getByRole('button', { name: /chart$/i });
    expect(newChartButton).toBeInTheDocument();
    expect(screen.getByTestId('plus')).toBeInTheDocument();

    // Click the New Chart button
    fireEvent.click(newChartButton);

    // Verify it triggers navigation to chart creation
    await waitFor(
      () => {
        expect(window.location.pathname).toEqual('/chart/add');
      },
      { timeout: 5000 },
    );
  });

  test('opens import modal on Import button click', async () => {
    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');

    // Verify Import button exists
    const importButton = screen.getByTestId('import-button');
    expect(importButton).toBeInTheDocument();

    // Click the Import button
    fireEvent.click(importButton);

    // Verify import modal opens
    await waitFor(() => {
      const importModal = screen.getByRole('dialog');
      expect(importModal).toBeInTheDocument();
      expect(importModal).toHaveTextContent(/import/i);
    });
  });

  test('shows loading state during initial data fetch', async () => {
    // Delay the chart data response to test loading state
    // fetchMock.removeRoute(API_ENDPOINTS.CHARTS)
    fetchMock.removeRoutes();
    fetchMock.get(
      API_ENDPOINTS.CHARTS,
      new Promise(resolve =>
        setTimeout(() => resolve({ result: mockCharts, chart_count: 3 }), 200),
      ),
      { name: API_ENDPOINTS.CHARTS },
    );

    renderChartList(mockUser);

    // Component should render immediately with loading state
    expect(screen.getByTestId('chart-list-view')).toBeInTheDocument();

    // Wait for data to eventually load
    await waitFor(
      () => {
        expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });

  test('makes correct API calls on initial load', async () => {
    renderChartList(mockUser);

    await waitFor(() => {
      const infoCalls = fetchMock.callHistory.calls(/chart\/_info/);
      const dataCalls = fetchMock.callHistory.calls(/chart\/\?q/);

      expect(infoCalls).toHaveLength(1);
      expect(dataCalls).toHaveLength(1);
      expect(dataCalls[0].url).toContain(
        'order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:25',
      );
    });
  });

  test('displays Matrixify tag for charts with matrixify enabled', async () => {
    renderChartList(mockUser);

    // Wait for the chart list to load
    await waitFor(() => {
      expect(screen.getByText('Test Chart 0')).toBeInTheDocument();
    });

    // Find the row containing Test Chart 0 (which has matrixify enabled)
    const chart0Row = screen.getByText('Test Chart 0').closest('tr');
    expect(chart0Row).toBeInTheDocument();

    // Check that the Matrixify tag is present in this row
    const matrixifyTag = within(chart0Row as HTMLElement).getByText(
      'Matrixified',
    );
    expect(matrixifyTag).toBeInTheDocument();

    // Find the row containing Test Chart 1 (which doesn't have matrixify)
    const chart1Row = screen.getByText('Test Chart 1').closest('tr');
    expect(chart1Row).toBeInTheDocument();

    // Check that the Matrixify tag is NOT present in this row
    expect(
      within(chart1Row as HTMLElement).queryByText('Matrixified'),
    ).not.toBeInTheDocument();
  });

  test('handles API errors gracefully', async () => {
    // Mock API failure
    fetchMock.removeRoutes();
    fetchMock.get(
      API_ENDPOINTS.CHARTS_INFO,
      { throws: new Error('API Error') },
      { name: API_ENDPOINTS.CHARTS_INFO },
    );

    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');

    // Should handle error gracefully and still render component
    expect(screen.getByTestId('chart-list-view')).toBeInTheDocument();
  });

  test('renders controls when chart list is empty', async () => {
    // Mock empty chart data (not permissions)
    fetchMock.removeRoute(API_ENDPOINTS.CHARTS);
    fetchMock.get(
      API_ENDPOINTS.CHARTS,
      { result: [], chart_count: 0 },
      { name: API_ENDPOINTS.CHARTS },
    );

    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');

    // Should render component even with no data
    expect(screen.getByTestId('chart-list-view')).toBeInTheDocument();

    // Global controls should still be functional with no data
    expect(screen.getByRole('img', { name: 'appstore' })).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'unordered-list' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Bulk select' }),
    ).toBeInTheDocument();
  });

  test('archive (soft-delete) confirmation reflects recoverable semantics, not delete', async () => {
    // With SOFT_DELETE on, the same delete affordance becomes reversible: the
    // dialog reads "Archive", not "Delete", and drops the "type DELETE to
    // confirm" gate -- that friction is reserved for the permanent purge in
    // the Recently Archived view, not this one.
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockImplementation((feature: string) => feature === 'SOFT_DELETE');

    // isUserEditorOrAdmin requires `username` + `permissions` to recognize an
    // Admin role (see src/types/bootstrapTypes.ts's isUserWithPermissionsAndRoles);
    // mockUser lacks both, so row actions would otherwise render disabled.
    const adminUser = { ...mockUser, username: 'admin', permissions: {} };
    renderChartList(adminUser);
    await screen.findByTestId('chart-list-view');

    const deleteButtons = await screen.findAllByTestId('chart-row-delete');
    fireEvent.click(deleteButtons[0]);

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(`Archive ${mockCharts[0].slice_name}?`),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Archive' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/moved to Recently Archived/i),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/recover it there/i)).toBeInTheDocument();

    expect(screen.queryByTestId('delete-modal-input')).not.toBeInTheDocument();
  });
});

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('ChartList - Global Filter Interactions', () => {
  beforeEach(() => {
    fetchMock.removeRoutes();
    setupMocks();
  });

  afterEach(() => {
    fetchMock.clearHistory();
    // Reset feature flag mock
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockReset();
  });

  test('renders all standard filters', async () => {
    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');
    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });

    // Search filter
    expect(screen.getByTestId('filters-search')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/type a value/i)).toBeInTheDocument();

    // All standard select filters
    const standardFilters = [
      'Type',
      'Dataset',
      'Editor',
      'Certified',
      'Favorite',
      'Dashboard',
      'Modified by',
    ];
    standardFilters.forEach(filterLabel => {
      const filter = findFilterByLabel(filterLabel);
      expect(filter).toBeVisible();
      expect(filter).toBeEnabled();
    });
  });

  test('renders Tags filter when TAGGING_SYSTEM is enabled', async () => {
    // Mock feature flag to enable tags
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockImplementation((feature: string) => feature === 'TAGGING_SYSTEM');

    // Render with tag permissions
    const userWithTagPerms = {
      ...mockUser,
      roles: {
        Admin: [
          ['can_sqllab', 'Superset'],
          ['can_write', 'Dashboard'],
          ['can_write', 'Chart'],
          ['can_read', 'Tag'],
          ['can_write', 'Tag'],
        ],
      },
    };
    renderChartList(userWithTagPerms);

    const tagsFilter = findFilterByLabel('Tag');
    expect(tagsFilter).toBeVisible();
    expect(tagsFilter).toBeEnabled();
  });

  test('does not render Tags filter when TAGGING_SYSTEM is disabled', async () => {
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockImplementation(() => false);

    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');
    await screen.findByTestId('listview-table');

    // Check that Tag filter is not present in filter containers
    const containers = screen.getAllByTestId('select-filter-container');
    const filterLabels = containers
      .map(container => {
        const label = container.querySelector('label');
        return label?.textContent;
      })
      .filter(Boolean);
    expect(filterLabels).not.toContain('Tag');
  });

  test('resets search filter value on clear', async () => {
    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');

    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });

    // Apply search filter
    const searchInput = screen.getByTestId('filters-search');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });

    // Verify filter UI is reset
    expect((searchInput as HTMLInputElement).value).toBe('');
  });
});

// The blocking-alerts/reports pre-flight in the Archive modal (sc-117151).
// Each test registers its report-API route BEFORE setupMocks so it takes
// precedence over the catch-all route.
const adminChartUser = { ...mockUser, username: 'admin', permissions: {} };

const openFirstDeleteModal = async () => {
  // ALERT_REPORTS must be on for the pre-flight to fire at all — with it off
  // the modal opens synchronously with no dependency fetch (see the flag-off
  // test below).
  (
    isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
  ).mockImplementation(
    (feature: string) =>
      feature === 'SOFT_DELETE' || feature === 'ALERT_REPORTS',
  );
  renderChartList(adminChartUser);
  await screen.findByTestId('chart-list-view');
  const deleteButtons = await screen.findAllByTestId('chart-row-delete');
  fireEvent.click(deleteButtons[0]);
  return screen.findByRole('dialog');
};

test('archive modal lists the blocking alerts and reports with their types', async () => {
  fetchMock.removeRoutes();
  fetchMock.get('glob:*/api/v1/report/*', {
    count: 2,
    result: [
      { id: 1, name: 'TC-081 rerun report', type: 'Report' },
      { id: 2, name: 'Threshold alert', type: 'Alert' },
    ],
  });
  setupMocks();
  try {
    const dialog = await openFirstDeleteModal();
    expect(
      within(dialog).getByText('Associated alerts and reports'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('TC-081 rerun report')).toBeInTheDocument();
    expect(within(dialog).getByText('Threshold alert')).toBeInTheDocument();
    expect(within(dialog).getByText('Report')).toBeInTheDocument();
    expect(within(dialog).getByText('Alert')).toBeInTheDocument();
    // Advisory only: the Archive button stays enabled.
    expect(
      within(dialog).getByRole('button', { name: 'Archive' }),
    ).toBeEnabled();
  } finally {
    fetchMock.clearHistory();
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockReset();
  }
});

test('archive modal is unchanged when the chart has no alerts or reports', async () => {
  fetchMock.removeRoutes();
  fetchMock.get('glob:*/api/v1/report/*', { count: 0, result: [] });
  setupMocks();
  try {
    const dialog = await openFirstDeleteModal();
    expect(
      within(dialog).getByText(/moved to Recently Archived/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByText('Associated alerts and reports'),
    ).not.toBeInTheDocument();
  } finally {
    fetchMock.clearHistory();
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockReset();
  }
});

test('archive modal opens unchanged and confirm still deletes when the report API 404s', async () => {
  fetchMock.removeRoutes();
  fetchMock.get('glob:*/api/v1/report/*', 404);
  fetchMock.delete(`glob:*/api/v1/chart/${mockCharts[0].id}`, {});
  setupMocks();
  try {
    const dialog = await openFirstDeleteModal();
    expect(
      within(dialog).queryByText('Associated alerts and reports'),
    ).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }));
    await waitFor(() =>
      expect(
        fetchMock.callHistory.calls(`glob:*/api/v1/chart/${mockCharts[0].id}`),
      ).toHaveLength(1),
    );
  } finally {
    fetchMock.clearHistory();
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockReset();
  }
});

test('archive modal caps the list at ten and reports the overflow count', async () => {
  fetchMock.removeRoutes();
  fetchMock.get('glob:*/api/v1/report/*', {
    count: 12,
    result: Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: `Blocking report ${i + 1}`,
      type: 'Report',
    })),
  });
  setupMocks();
  try {
    const dialog = await openFirstDeleteModal();
    expect(within(dialog).getByText('Blocking report 10')).toBeInTheDocument();
    expect(within(dialog).getByText('... and 2 more')).toBeInTheDocument();
  } finally {
    fetchMock.clearHistory();
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockReset();
  }
});

test('archive modal refetches on every open so the list stays fresh', async () => {
  fetchMock.removeRoutes();
  fetchMock.get(
    'glob:*/api/v1/report/*',
    {
      count: 1,
      result: [{ id: 1, name: 'Detach me first', type: 'Report' }],
    },
    { name: 'blocking-reports' },
  );
  setupMocks();
  try {
    const dialog = await openFirstDeleteModal();
    expect(within(dialog).getByText('Detach me first')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    // The user detaches the report; the next open must show the new truth.
    fetchMock.removeRoute('blocking-reports');
    fetchMock.get(
      'glob:*/api/v1/report/*',
      { count: 0, result: [] },
      { name: 'blocking-reports-empty' },
    );
    const deleteButtons = await screen.findAllByTestId('chart-row-delete');
    fireEvent.click(deleteButtons[0]);
    const reopened = await screen.findByRole('dialog');
    expect(
      within(reopened).queryByText('Detach me first'),
    ).not.toBeInTheDocument();
    expect(
      within(reopened).queryByText('Associated alerts and reports'),
    ).not.toBeInTheDocument();
  } finally {
    fetchMock.clearHistory();
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockReset();
  }
});

test('archive modal opens without any report fetch when ALERT_REPORTS is off', async () => {
  fetchMock.removeRoutes();
  fetchMock.get(
    'glob:*/api/v1/report/*',
    {
      count: 1,
      result: [{ id: 1, name: 'Should not appear', type: 'Report' }],
    },
    { name: 'reports-should-not-be-called' },
  );
  setupMocks();
  (
    isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
  ).mockImplementation((feature: string) => feature === 'SOFT_DELETE');
  try {
    renderChartList(adminChartUser);
    await screen.findByTestId('chart-list-view');
    const deleteButtons = await screen.findAllByTestId('chart-row-delete');
    fireEvent.click(deleteButtons[0]);
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).queryByText('Associated alerts and reports'),
    ).not.toBeInTheDocument();
    expect(
      fetchMock.callHistory.calls('reports-should-not-be-called'),
    ).toHaveLength(0);
  } finally {
    fetchMock.clearHistory();
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockReset();
  }
});

test('delete confirmation keeps the type-DELETE gate when SOFT_DELETE is off', async () => {
  fetchMock.removeRoutes();
  fetchMock.get('glob:*/api/v1/report/*', { count: 0, result: [] });
  setupMocks();
  (
    isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
  ).mockImplementation((feature: string) => feature === 'ALERT_REPORTS');
  try {
    renderChartList(adminChartUser);
    await screen.findByTestId('chart-list-view');
    const deleteButtons = await screen.findAllByTestId('chart-row-delete');
    fireEvent.click(deleteButtons[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Please confirm')).toBeInTheDocument();
    expect(screen.getByTestId('delete-modal-input')).toBeInTheDocument();
  } finally {
    fetchMock.clearHistory();
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockReset();
  }
});
