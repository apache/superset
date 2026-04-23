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
import { screen, waitFor, within } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { isFeatureEnabled } from '@superset-ui/core';
import {
  mockCharts,
  mockHandleResourceExport,
  setupMocks,
  renderChartList,
  API_ENDPOINTS,
} from './ChartList.testHelpers';

// Increase default timeout for all tests
jest.setTimeout(30000);

// Mock the feature flag
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

// Mock the export utility
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
      ['can_sqllab', 'Superset'],
      ['can_write', 'Dashboard'],
      ['can_write', 'Chart'],
      ['can_export', 'Chart'],
    ],
  },
};

beforeEach(() => {
  mockHandleResourceExport.mockClear();
  setupMocks();
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  fetchMock.removeRoutes();
  mockIsFeatureEnabled.mockReset();
});

test('renders table in list view', async () => {
  renderChartList(mockUser);

  // Wait for component to load
  await waitFor(() => {
    expect(screen.getByTestId('chart-list-view')).toBeInTheDocument();
  });

  // Wait for table to be rendered
  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // Verify cards are not rendered in list view
  expect(screen.queryByTestId('styled-card')).not.toBeInTheDocument();
});

test('displays dataset names with and without schema prefix', async () => {
  // Create custom mock data with different datasource_name_text formats
  const customMockCharts = [
    {
      ...mockCharts[0],
      id: 100,
      slice_name: 'Chart with Schema',
      datasource_name_text: 'public.test_dataset',
    },
    {
      ...mockCharts[0],
      id: 101,
      slice_name: 'Chart without Schema',
      datasource_name_text: 'Jinja 5', // Virtual dataset without schema
    },
    {
      ...mockCharts[0],
      id: 102,
      slice_name: 'Chart with Dots in Name',
      datasource_name_text: 'schema.table.with.dots', // Name contains dots
    },
  ];

  // Setup mock with custom charts
  fetchMock.removeRoutes();
  setupMocks();
  fetchMock.modifyRoute(API_ENDPOINTS.CHARTS, {
    response: {
      result: customMockCharts,
      chart_count: customMockCharts.length,
    },
  });

  renderChartList(mockUser);

  // Wait for table to be rendered
  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // Wait for data to load
  await waitFor(() => {
    expect(screen.getByText('Chart with Schema')).toBeInTheDocument();
  });

  // Find the specific dataset links by their parent row context
  const schemaRow = screen.getByText('Chart with Schema').closest('tr');
  const noSchemaRow = screen.getByText('Chart without Schema').closest('tr');
  const dotsRow = screen.getByText('Chart with Dots in Name').closest('tr');

  // Check dataset name displays correctly for each case
  // For chart with schema (public.test_dataset)
  expect(schemaRow).toBeInTheDocument();
  const schemaLink = within(schemaRow!).getByRole('link', {
    name: /test_dataset/i,
  });
  expect(schemaLink).toBeInTheDocument();
  expect(schemaLink).toHaveTextContent('test_dataset');

  // For chart without schema (Jinja 5)
  expect(noSchemaRow).toBeInTheDocument();
  const noSchemaLink = within(noSchemaRow!).getByRole('link', {
    name: /Jinja 5/i,
  });
  expect(noSchemaLink).toBeInTheDocument();
  expect(noSchemaLink).toHaveTextContent('Jinja 5');

  // For chart with dots in name (schema.table.with.dots)
  expect(dotsRow).toBeInTheDocument();
  const dotsLink = within(dotsRow!).getByRole('link', {
    name: /table\.with\.dots/i,
  });
  expect(dotsLink).toBeInTheDocument();
  expect(dotsLink).toHaveTextContent('table.with.dots');
});

test('switches from list view to card view', async () => {
  renderChartList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // Switch to card view
  const cardViewToggle = screen.getByRole('img', { name: 'appstore' });
  await userEvent.click(cardViewToggle);

  // Verify table is no longer rendered
  await waitFor(() => {
    expect(screen.queryByTestId('listview-table')).not.toBeInTheDocument();
  });

  // Verify cards are rendered
  const cards = screen.getAllByTestId('styled-card');
  expect(cards).toHaveLength(mockCharts.length);
});

test('renders all required column headers', async () => {
  renderChartList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const columnHeaders = table.querySelectorAll('[role="columnheader"]');

  // All the table headers with default feature flags on
  const expectedHeaders = [
    'Name',
    'Type',
    'Dataset',
    'On dashboards',
    'Owners',
    'Last modified',
    'Actions',
  ];

  // Add one extra column header for favorite stars
  expect(columnHeaders).toHaveLength(expectedHeaders.length + 1);

  // Verify all expected headers are present
  expectedHeaders.forEach(headerText => {
    expect(within(table).getByTitle(headerText)).toBeInTheDocument();
  });
});

test('sorts table when clicking column headers', async () => {
  renderChartList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');

  const allHeaders = table.querySelectorAll('.ant-table-column-sorters');

  const sortableHeaders = Array.from(allHeaders).filter(
    header => !header.closest('.ant-table-measure-cell-content'),
  );
  expect(sortableHeaders).toHaveLength(3);

  const nameHeader = within(table).getByTitle('Name');
  await userEvent.click(nameHeader);

  await waitFor(() => {
    const sortCalls = fetchMock.callHistory
      .calls(/chart\/\?q/)
      .filter(
        call =>
          call.url.includes('order_column') && call.url.includes('slice_name'),
      );
    expect(sortCalls).toHaveLength(1);
  });

  const typeHeader = within(table).getByTitle('Type');
  await userEvent.click(typeHeader);

  await waitFor(() => {
    const typeSortCalls = fetchMock.callHistory
      .calls(/chart\/\?q/)
      .filter(
        call =>
          call.url.includes('order_column') && call.url.includes('viz_type'),
      );
    expect(typeSortCalls).toHaveLength(1);
  });

  const lastModifiedHeader = within(table).getByTitle('Last modified');
  await userEvent.click(lastModifiedHeader);

  await waitFor(() => {
    const lastModifiedSortCalls = fetchMock.callHistory
      .calls(/chart\/\?q/)
      .filter(
        call =>
          call.url.includes('order_column') &&
          call.url.includes('last_saved_at'),
      );
    expect(lastModifiedSortCalls).toHaveLength(1);
  });
});

test('displays chart data correctly in table rows', async () => {
  /**
   * @todo Implement test logic for tagging.
   * If TAGGING_SYSTEM is ever deprecated to always be on,
   * will need to combine this with the tagging column test.
   */
  renderChartList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const testChart = mockCharts[0];

  await waitFor(() => {
    expect(within(table).getByText(testChart.slice_name)).toBeInTheDocument();
  });

  // Find the specific row for our test chart
  const chartNameElement = within(table).getByText(testChart.slice_name);
  const chartRow = chartNameElement.closest(
    '[data-test="table-row"]',
  ) as HTMLElement;
  expect(chartRow).toBeInTheDocument();

  // Check for favorite star column within the specific row
  const favoriteButton = within(chartRow).getByTestId('fave-unfave-icon');
  expect(favoriteButton).toBeInTheDocument();
  expect(favoriteButton).toHaveAttribute('role', 'button');

  // Check chart name link within the specific row
  const chartLink = within(chartRow).getByTestId(
    `${testChart.slice_name}-list-chart-title`,
  );
  expect(chartLink).toBeInTheDocument();
  expect(chartLink).toHaveAttribute('href', testChart.url);

  // Check viz type within the specific row
  expect(within(chartRow).getByText(testChart.viz_type)).toBeInTheDocument();

  // Check dataset name and link within the specific row
  const datasetName = testChart.datasource_name_text?.split('.').pop() || '';
  expect(within(chartRow).getByText(datasetName)).toBeInTheDocument();

  const datasetLink = within(chartRow).getByTestId('internal-link');
  expect(datasetLink).toBeInTheDocument();
  expect(datasetLink).toHaveAttribute('href', testChart.datasource_url);

  // Check dashboard display within the specific row
  expect(
    within(chartRow).getByText(testChart.dashboards[0].dashboard_title),
  ).toBeInTheDocument();

  // Check owners display - find avatar group within the row
  const avatarGroup = chartRow.querySelector(
    '.ant-avatar-group',
  ) as HTMLElement;
  expect(avatarGroup).toBeInTheDocument();

  // Test owner initials for mockCharts[0] (we know it has owners)
  const ownerInitials = `${testChart.owners[0].first_name[0]}${testChart.owners[0].last_name[0]}`;
  expect(within(avatarGroup).getByText(ownerInitials)).toBeInTheDocument();

  // Check last modified time within the specific row
  expect(
    within(chartRow).getByText(testChart.changed_on_delta_humanized),
  ).toBeInTheDocument();

  // Verify action buttons exist within the specific row
  expect(within(chartRow).getByTestId('delete')).toBeInTheDocument();
  expect(within(chartRow).getByTestId('upload')).toBeInTheDocument();
  expect(within(chartRow).getByTestId('edit-alt')).toBeInTheDocument();
});

test('calls export API when export button is clicked', async () => {
  renderChartList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    expect(screen.getByText(mockCharts[1].slice_name)).toBeInTheDocument();
  });

  // Click first export button
  const table = screen.getByTestId('listview-table');
  const exportButtons = within(table).getAllByTestId('upload');
  await userEvent.click(exportButtons[0]);

  // Verify export functionality is triggered - check if handleResourceExport was called
  await waitFor(() => {
    expect(mockHandleResourceExport).toHaveBeenCalledWith(
      'chart',
      [mockCharts[0].id],
      expect.any(Function),
    );
  });
});

test('opens edit properties modal on edit button click', async () => {
  renderChartList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    expect(screen.getByText(mockCharts[1].slice_name)).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const editButtons = within(table).getAllByTestId('edit-alt');
  await userEvent.click(editButtons[0]);

  // Verify edit modal opens
  await waitFor(() => {
    const editModal = screen.getByRole('dialog');
    expect(editModal).toBeInTheDocument();
    expect(editModal).toHaveTextContent(/properties/i);
  });
});

test('opens delete confirmation on delete button click', async () => {
  renderChartList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    expect(screen.getByText(mockCharts[1].slice_name)).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const deleteButtons = within(table).getAllByTestId('delete');
  await userEvent.click(deleteButtons[0]);

  // Verify delete confirmation modal opens
  await waitFor(() => {
    const deleteModal = screen.getByRole('dialog');
    expect(deleteModal).toBeInTheDocument();
    expect(deleteModal).toHaveTextContent(/delete/i);
  });
});

test('displays certified badge only for certified charts', async () => {
  // Test certified chart (mockCharts[1] has certification)
  const certifiedChart = mockCharts[1];
  // Test uncertified chart (mockCharts[0] has no certification)
  const uncertifiedChart = mockCharts[0];

  renderChartList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    expect(screen.getByText(mockCharts[1].slice_name)).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');

  const certifiedChartElement = within(table).getByText(
    certifiedChart.slice_name,
  );
  const certifiedChartRow = certifiedChartElement.closest(
    '[data-test="table-row"]',
  ) as HTMLElement;
  const certifiedBadge = within(certifiedChartRow).getByLabelText('certified');
  expect(certifiedBadge).toBeInTheDocument();

  const uncertifiedChartElement = within(table).getByText(
    uncertifiedChart.slice_name,
  );
  const uncertifiedChartRow = uncertifiedChartElement.closest(
    '[data-test="table-row"]',
  ) as HTMLElement;
  expect(
    within(uncertifiedChartRow).queryByLabelText('certified'),
  ).not.toBeInTheDocument();
});

test('displays info icon only for charts with descriptions', async () => {
  // Test chart with description (mockCharts[0] has description)
  const chartWithDesc = mockCharts[0];
  // Test chart without description (mockCharts[2] has description: null)
  const chartNoDesc = mockCharts[2];

  renderChartList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    expect(screen.getByText(mockCharts[2].slice_name)).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');

  const chartWithDescElement = within(table).getByText(
    chartWithDesc.slice_name,
  );
  const chartWithDescRow = chartWithDescElement.closest(
    '[data-test="table-row"]',
  ) as HTMLElement;
  const infoTooltip =
    within(chartWithDescRow).getByLabelText('Show info tooltip');
  expect(infoTooltip).toBeInTheDocument();

  const chartNoDescElement = within(table).getByText(chartNoDesc.slice_name);
  const chartNoDescRow = chartNoDescElement.closest(
    '[data-test="table-row"]',
  ) as HTMLElement;
  expect(
    within(chartNoDescRow).queryByLabelText('Show info tooltip'),
  ).not.toBeInTheDocument();
});

test('renders empty dashboard column for charts without dashboards', async () => {
  renderChartList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByText(mockCharts[2].slice_name)).toBeInTheDocument();
  });

  // Test mockCharts[2] which has dashboards: []
  const table = screen.getByTestId('listview-table');
  const chartNameElement = within(table).getByText(mockCharts[2].slice_name);
  const chartRow = chartNameElement.closest(
    '[data-test="table-row"]',
  ) as HTMLElement;

  // Chart should still render - chart name should be visible
  expect(
    within(chartRow).getByText(mockCharts[2].slice_name),
  ).toBeInTheDocument();

  // Find dashboard column index by header
  const headers = within(table).getAllByRole('columnheader');
  const dashboardHeaderIndex = headers.findIndex(header =>
    header.textContent?.includes('On dashboards'),
  );
  expect(dashboardHeaderIndex).toBeGreaterThan(-1); // Ensure column exists

  // Since mockCharts[2] has dashboards: [], verify dashboard cell is empty
  const dashboardCell =
    within(chartRow).getAllByRole('cell')[dashboardHeaderIndex];
  expect(dashboardCell).toBeInTheDocument();

  // Verify no dashboard links are present in this cell
  expect(within(dashboardCell).queryByRole('link')).not.toBeInTheDocument();
});

test('renders dashboard crosslinks as navigable links', async () => {
  renderChartList(mockUser);
  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');

  // mockCharts[1] has multiple dashboards - verify all render with correct hrefs
  const chartRow = within(table)
    .getByText(mockCharts[1].slice_name)
    .closest('[data-test="table-row"]') as HTMLElement;
  const crosslinks = within(chartRow).getByTestId('crosslinks');
  const dashboards = mockCharts[1].dashboards as {
    dashboard_title: string;
    id: number;
  }[];
  const links = within(crosslinks).getAllByRole('link');
  expect(links).toHaveLength(dashboards.length);
  dashboards.forEach(dashboard => {
    expect(
      within(crosslinks).getByRole('link', {
        name: new RegExp(dashboard.dashboard_title),
      }),
    ).toHaveAttribute('href', `/superset/dashboard/${dashboard.id}`);
  });
});

test('shows tag column when TAGGING_SYSTEM is enabled', async () => {
  // Enable tagging system feature flag
  mockIsFeatureEnabled.mockImplementation(
    feature => feature === 'TAGGING_SYSTEM',
  );

  renderChartList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const testChart = mockCharts[0];
  const table = screen.getByTestId('listview-table');
  expect(within(table).getByTitle('Tags')).toBeInTheDocument();

  await waitFor(() => {
    expect(within(table).getByText(testChart.slice_name)).toBeInTheDocument();
  });

  const chartNameElement = within(table).getByText(testChart.slice_name);
  const chartRow = chartNameElement.closest(
    '[data-test="table-row"]',
  ) as HTMLElement;
  expect(chartRow).toBeInTheDocument();

  const tagList = chartRow.querySelector('.tag-list') as HTMLElement;
  expect(tagList).toBeInTheDocument();

  // Find the tag in the row
  const tag = within(tagList).getByTestId('tag');
  expect(tag).toBeInTheDocument();
  expect(tag).toHaveTextContent('basic');

  // Tag should be a link to all_entities page
  const tagLink = within(tag).getByRole('link');
  expect(tagLink).toHaveAttribute('href', '/superset/all_entities/?id=1');
  expect(tagLink).toHaveAttribute('target', '_blank');
});

test('supports bulk select and deselect all', async () => {
  renderChartList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    expect(screen.getByText(mockCharts[1].slice_name)).toBeInTheDocument();
  });

  const bulkSelectButton = screen.getByTestId('bulk-select');
  await userEvent.click(bulkSelectButton);

  await waitFor(() => {
    // Expect header checkbox + one checkbox per chart
    expect(screen.getAllByRole('checkbox')).toHaveLength(mockCharts.length + 1);
  });

  // Use the header checkbox to select all
  const selectAllCheckbox = screen.getAllByLabelText('Select all')[0];
  expect(selectAllCheckbox).not.toBeChecked();

  await userEvent.click(selectAllCheckbox);

  await waitFor(() => {
    // Should show all charts selected
    expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
      `${mockCharts.length} Selected`,
    );
  });

  // All checkboxes should be checked
  let checkboxes = screen.getAllByRole('checkbox');
  checkboxes.forEach(checkbox => {
    expect(checkbox).toBeChecked();
  });

  // Use the deselect all link to deselect all
  const deselectAllButton = screen.getByTestId('bulk-select-deselect-all');
  await userEvent.click(deselectAllButton);

  await waitFor(() => {
    // Should show 0 selected
    expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
      '0 Selected',
    );
  });

  // All checkboxes should be unchecked
  checkboxes = screen.getAllByRole('checkbox');
  checkboxes.forEach(checkbox => {
    expect(checkbox).not.toBeChecked();
  });

  // Bulk action buttons should disappear
  expect(screen.queryByTestId('bulk-select-action')).not.toBeInTheDocument();
});

test('supports bulk export of selected charts', async () => {
  renderChartList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
  });

  const bulkSelectButton = screen.getByTestId('bulk-select');
  await userEvent.click(bulkSelectButton);

  await waitFor(() => {
    // Expect header checkbox + one checkbox per chart
    expect(screen.getAllByRole('checkbox')).toHaveLength(mockCharts.length + 1);
  });

  // Use select all to select multiple charts
  const selectAllCheckbox = screen.getAllByLabelText('Select all')[0];
  await userEvent.click(selectAllCheckbox);

  await waitFor(() => {
    expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
      `${mockCharts.length} Selected`,
    );
  });

  // Click bulk export button
  const bulkActions = screen.getAllByTestId('bulk-select-action');
  const exportButton = bulkActions.find(btn => btn.textContent === 'Export');
  expect(exportButton).toBeInTheDocument();

  await userEvent.click(exportButton!);

  // Verify export function was called with all chart IDs
  await waitFor(() => {
    expect(mockHandleResourceExport).toHaveBeenCalledWith(
      'chart',
      mockCharts.map(chart => chart.id),
      expect.any(Function),
    );
  });
});

test('supports bulk delete of selected charts', async () => {
  renderChartList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    expect(screen.getByText(mockCharts[1].slice_name)).toBeInTheDocument();
  });

  const bulkSelectButton = screen.getByTestId('bulk-select');
  await userEvent.click(bulkSelectButton);

  await waitFor(() => {
    // Expect header checkbox + one checkbox per chart
    expect(screen.getAllByRole('checkbox')).toHaveLength(mockCharts.length + 1);
  });

  // Use select all to select multiple charts
  const selectAllCheckbox = screen.getAllByLabelText('Select all')[0];
  await userEvent.click(selectAllCheckbox);

  await waitFor(() => {
    expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
      `${mockCharts.length} Selected`,
    );
  });

  // Click bulk delete button
  const bulkActions = screen.getAllByTestId('bulk-select-action');
  const deleteButton = bulkActions.find(btn => btn.textContent === 'Delete');
  expect(deleteButton).toBeInTheDocument();

  await userEvent.click(deleteButton!);

  // Should open delete confirmation modal
  await waitFor(() => {
    const deleteModal = screen.getByRole('dialog');
    expect(deleteModal).toBeInTheDocument();
    expect(deleteModal).toHaveTextContent(/delete/i);
    expect(deleteModal).toHaveTextContent(/selected charts/i);
  });
});

test('supports bulk add tags to selected charts', async () => {
  // Enable tagging system feature flag
  mockIsFeatureEnabled.mockImplementation(
    feature => feature === 'TAGGING_SYSTEM',
  );

  renderChartList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // Wait for chart data to load
  await waitFor(() => {
    expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    expect(screen.getByText(mockCharts[1].slice_name)).toBeInTheDocument();
  });

  // Activate bulk select and select charts
  const bulkSelectButton = screen.getByTestId('bulk-select');
  await userEvent.click(bulkSelectButton);

  await waitFor(() => {
    // Expect header checkbox + one checkbox per chart
    expect(screen.getAllByRole('checkbox')).toHaveLength(mockCharts.length + 1);
  });

  // Select first chart
  const table = screen.getByTestId('listview-table');
  // Target first data row specifically (not header row)
  const dataRows = within(table).getAllByTestId('table-row');
  const firstRowCheckbox = within(dataRows[0]).getByRole('checkbox');
  await userEvent.click(firstRowCheckbox);

  await waitFor(() => {
    expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
      '1 Selected',
    );
  });

  const addTagButton = screen.queryByText('Add Tag') as HTMLButtonElement;
  expect(addTagButton).toBeInTheDocument();
  await userEvent.click(addTagButton);

  await waitFor(() => {
    const tagModal = screen.getByRole('dialog');
    expect(tagModal).toBeInTheDocument();
    expect(tagModal).toHaveTextContent(/tag/i);
  });
});

test('exits bulk select on button toggle', async () => {
  renderChartList(mockUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    expect(screen.getByText(mockCharts[1].slice_name)).toBeInTheDocument();
  });

  const bulkSelectButton = screen.getByTestId('bulk-select');
  await userEvent.click(bulkSelectButton);

  await waitFor(() => {
    // Expect header checkbox + one checkbox per chart
    expect(screen.getAllByRole('checkbox')).toHaveLength(mockCharts.length + 1);
  });

  const table = screen.getByTestId('listview-table');
  // Target first data row specifically (not header row)
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
