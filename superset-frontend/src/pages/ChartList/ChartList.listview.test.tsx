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
  mockCharts,
  mockHandleResourceExport,
  setupMocks,
  renderChartList,
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

describe('ChartList - List View Tests', () => {
  beforeEach(() => {
    mockHandleResourceExport.mockClear();
    setupMocks();
  });

  afterEach(() => {
    fetchMock.restore();
  });

  it('renders ChartList in list view', async () => {
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
    await waitFor(() => {
      expect(screen.queryByTestId('styled-card')).not.toBeInTheDocument();
    });
  });

  it('switches from list view to card view', async () => {
    renderChartList(mockUser);

    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });

    // Switch to card view
    const cardViewToggle = screen.getByRole('img', { name: 'appstore' });
    fireEvent.click(cardViewToggle);

    // Verify table is no longer rendered
    await waitFor(() => {
      expect(screen.queryByTestId('listview-table')).not.toBeInTheDocument();
    });

    // Verify cards are rendered
    const cards = screen.getAllByTestId('styled-card');
    expect(cards).toHaveLength(mockCharts.length);
  });

  it('renders all required column headers', async () => {
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
      expect(within(table).getByText(headerText)).toBeInTheDocument();
    });
  });

  it('sorts table when clicking column headers', async () => {
    renderChartList(mockUser);

    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });

    const table = screen.getByTestId('listview-table');
    const sortableHeaders = table.querySelectorAll('.ant-table-column-sorters');

    expect(sortableHeaders).toHaveLength(3);

    const nameHeader = within(table).getByText('Name');
    fireEvent.click(nameHeader);

    await waitFor(() => {
      const sortCalls = fetchMock
        .calls(/chart\/\?q/)
        .filter(
          call =>
            call[0].includes('order_column') && call[0].includes('slice_name'),
        );
      expect(sortCalls).toHaveLength(1);
    });

    const typeHeader = within(table).getByText('Type');
    fireEvent.click(typeHeader);

    await waitFor(() => {
      const typeSortCalls = fetchMock
        .calls(/chart\/\?q/)
        .filter(
          call =>
            call[0].includes('order_column') && call[0].includes('viz_type'),
        );
      expect(typeSortCalls).toHaveLength(1);
    });

    const lastModifiedHeader = within(table).getByText('Last modified');
    fireEvent.click(lastModifiedHeader);

    await waitFor(() => {
      const lastModifiedSortCalls = fetchMock
        .calls(/chart\/\?q/)
        .filter(
          call =>
            call[0].includes('order_column') &&
            call[0].includes('last_saved_at'),
        );
      expect(lastModifiedSortCalls).toHaveLength(1);
    });
  });

  it('displays chart data correctly', async () => {
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

    // Check actions column within the specific row
    const actionsContainer = chartRow.querySelector('.actions');
    expect(actionsContainer).toBeInTheDocument();

    // Verify action buttons exist within the specific row
    expect(within(chartRow).getByTestId('delete')).toBeInTheDocument();
    expect(within(chartRow).getByTestId('upload')).toBeInTheDocument();
    expect(within(chartRow).getByTestId('edit-alt')).toBeInTheDocument();
  });

  it('export chart api called when export button is clicked', async () => {
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
    fireEvent.click(exportButtons[0]);

    // Verify export functionality is triggered - check if handleResourceExport was called
    await waitFor(() => {
      expect(mockHandleResourceExport).toHaveBeenCalledWith(
        'chart',
        [mockCharts[0].id],
        expect.any(Function),
      );
    });
  });

  it('opens edit properties modal when edit button is clicked', async () => {
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
    fireEvent.click(editButtons[0]);

    // Verify edit modal opens
    await waitFor(() => {
      const editModal = screen.getByRole('dialog');
      expect(editModal).toBeInTheDocument();
      expect(editModal).toHaveTextContent(/properties/i);
    });
  });

  it('opens delete confirmation when delete button is clicked', async () => {
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
    fireEvent.click(deleteButtons[0]);

    // Verify delete confirmation modal opens
    await waitFor(() => {
      const deleteModal = screen.getByRole('dialog');
      expect(deleteModal).toBeInTheDocument();
      expect(deleteModal).toHaveTextContent(/delete/i);
    });
  });

  it('displays certified badge only for certified charts', async () => {
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
    const certifiedBadge =
      within(certifiedChartRow).getByLabelText('certified');
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

  it('displays info icon only for charts with descriptions', async () => {
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

  it('displays chart with empty dataset column', async () => {
    renderChartList(mockUser);

    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(mockCharts[2].slice_name)).toBeInTheDocument();
    });

    const table = screen.getByTestId('listview-table');
    const chartNameElement = within(table).getByText(mockCharts[2].slice_name);
    const chartRow = chartNameElement.closest(
      '[data-test="table-row"]',
    ) as HTMLElement;

    // Chart name should be visible
    expect(
      within(chartRow).getByText(mockCharts[2].slice_name),
    ).toBeInTheDocument();

    // Find dataset column index by header
    const headers = within(table).getAllByRole('columnheader');
    const datasetHeaderIndex = headers.findIndex(header =>
      header.textContent?.includes('Dataset'),
    );
    expect(datasetHeaderIndex).toBeGreaterThan(-1); // Ensure column exists

    // Since mockCharts[2] has datasource_name_text: null, verify dataset cell is empty
    const datasetCell =
      within(chartRow).getAllByRole('cell')[datasetHeaderIndex];
    expect(datasetCell).toBeInTheDocument();

    // Verify dataset cell is empty for charts with no dataset
    expect(datasetCell).toHaveTextContent('');
    // There's a link element but with empty href
    const datasetLink = within(datasetCell).getByRole('link');
    expect(datasetLink).toHaveAttribute('href', '');
  });

  it('displays chart with empty on dashboards column', async () => {
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

  it('shows tag info when TAGGING_SYSTEM is enabled', async () => {
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
    expect(within(table).getByText('Tags')).toBeInTheDocument();

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

  it('can bulk select and deselect all charts', async () => {
    renderChartList(mockUser);

    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
      expect(screen.getByText(mockCharts[1].slice_name)).toBeInTheDocument();
    });

    const bulkSelectButton = screen.getByTestId('bulk-select');
    fireEvent.click(bulkSelectButton);

    await waitFor(() => {
      // Expect header checkbox + one checkbox per chart
      expect(screen.getAllByRole('checkbox')).toHaveLength(
        mockCharts.length + 1,
      );
    });

    // Use the header checkbox to select all
    const selectAllCheckbox = screen.getByLabelText('Select all');
    expect(selectAllCheckbox).not.toBeChecked();

    fireEvent.click(selectAllCheckbox);

    await waitFor(() => {
      // All checkboxes should be checked
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked();
      });

      // Should show all charts selected
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        `${mockCharts.length} Selected`,
      );
    });

    // Use the deselect all link to deselect all
    const deselectAllButton = screen.getByTestId('bulk-select-deselect-all');
    fireEvent.click(deselectAllButton);

    await waitFor(() => {
      // All checkboxes should be unchecked
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).not.toBeChecked();
      });

      // Should show 0 selected
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        '0 Selected',
      );

      // Bulk action buttons should disappear
      expect(
        screen.queryByTestId('bulk-select-action'),
      ).not.toBeInTheDocument();
    });
  });

  it('can bulk export selected charts', async () => {
    renderChartList(mockUser);

    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    });

    const bulkSelectButton = screen.getByTestId('bulk-select');
    fireEvent.click(bulkSelectButton);

    await waitFor(() => {
      // Expect header checkbox + one checkbox per chart
      expect(screen.getAllByRole('checkbox')).toHaveLength(
        mockCharts.length + 1,
      );
    });

    // Use select all to select multiple charts
    const selectAllCheckbox = screen.getByLabelText('Select all');
    fireEvent.click(selectAllCheckbox);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        `${mockCharts.length} Selected`,
      );
    });

    // Click bulk export button
    const bulkActions = screen.getAllByTestId('bulk-select-action');
    const exportButton = bulkActions.find(btn => btn.textContent === 'Export');
    expect(exportButton).toBeInTheDocument();

    fireEvent.click(exportButton!);

    // Verify export function was called with all chart IDs
    await waitFor(() => {
      expect(mockHandleResourceExport).toHaveBeenCalledWith(
        'chart',
        mockCharts.map(chart => chart.id),
        expect.any(Function),
      );
    });
  });

  it('can bulk delete selected charts', async () => {
    renderChartList(mockUser);

    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
      expect(screen.getByText(mockCharts[1].slice_name)).toBeInTheDocument();
    });

    const bulkSelectButton = screen.getByTestId('bulk-select');
    fireEvent.click(bulkSelectButton);

    await waitFor(() => {
      // Expect header checkbox + one checkbox per chart
      expect(screen.getAllByRole('checkbox')).toHaveLength(
        mockCharts.length + 1,
      );
    });

    // Use select all to select multiple charts
    const selectAllCheckbox = screen.getByLabelText('Select all');
    fireEvent.click(selectAllCheckbox);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        `${mockCharts.length} Selected`,
      );
    });

    // Click bulk delete button
    const bulkActions = screen.getAllByTestId('bulk-select-action');
    const deleteButton = bulkActions.find(btn => btn.textContent === 'Delete');
    expect(deleteButton).toBeInTheDocument();

    fireEvent.click(deleteButton!);

    // Should open delete confirmation modal
    await waitFor(() => {
      const deleteModal = screen.getByRole('dialog');
      expect(deleteModal).toBeInTheDocument();
      expect(deleteModal).toHaveTextContent(/delete/i);
      expect(deleteModal).toHaveTextContent(/selected charts/i);
    });
  });

  it('can bulk add tags to selected charts', async () => {
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
    fireEvent.click(bulkSelectButton);

    await waitFor(() => {
      // Expect header checkbox + one checkbox per chart
      expect(screen.getAllByRole('checkbox')).toHaveLength(
        mockCharts.length + 1,
      );
    });

    // Select first chart
    const table = screen.getByTestId('listview-table');
    // Target first data row specifically (not header row)
    const dataRows = within(table).getAllByTestId('table-row');
    const firstRowCheckbox = within(dataRows[0]).getByRole('checkbox');
    fireEvent.click(firstRowCheckbox);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        '1 Selected',
      );
    });

    const addTagButton = screen.queryByText('Add Tag') as HTMLButtonElement;
    expect(addTagButton).toBeInTheDocument();
    fireEvent.click(addTagButton);

    await waitFor(() => {
      const tagModal = screen.getByRole('dialog');
      expect(tagModal).toBeInTheDocument();
      expect(tagModal).toHaveTextContent(/tag/i);
    });
  });

  it('exit bulk select by hitting x on bulk select bar', async () => {
    renderChartList(mockUser);

    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
      expect(screen.getByText(mockCharts[1].slice_name)).toBeInTheDocument();
    });

    const bulkSelectButton = screen.getByTestId('bulk-select');
    fireEvent.click(bulkSelectButton);

    await waitFor(() => {
      // Expect header checkbox + one checkbox per chart
      expect(screen.getAllByRole('checkbox')).toHaveLength(
        mockCharts.length + 1,
      );
    });

    const table = screen.getByTestId('listview-table');
    // Target first data row specifically (not header row)
    const dataRows = within(table).getAllByTestId('table-row');
    const firstRowCheckbox = within(dataRows[0]).getByRole('checkbox');
    fireEvent.click(firstRowCheckbox);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        '1 Selected',
      );
    });

    // Find and click the close button (x) on the bulk select bar
    const closeIcon = document.querySelector(
      '.ant-alert-close-icon',
    ) as HTMLButtonElement;
    fireEvent.click(closeIcon);

    await waitFor(() => {
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
      expect(screen.queryByTestId('bulk-select-copy')).not.toBeInTheDocument();
    });
  });

  it('exit bulk select by clicking bulk select button again', async () => {
    renderChartList(mockUser);

    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
      expect(screen.getByText(mockCharts[1].slice_name)).toBeInTheDocument();
    });

    const bulkSelectButton = screen.getByTestId('bulk-select');
    fireEvent.click(bulkSelectButton);

    await waitFor(() => {
      // Expect header checkbox + one checkbox per chart
      expect(screen.getAllByRole('checkbox')).toHaveLength(
        mockCharts.length + 1,
      );
    });

    const table = screen.getByTestId('listview-table');
    // Target first data row specifically (not header row)
    const dataRows = within(table).getAllByTestId('table-row');
    const firstRowCheckbox = within(dataRows[0]).getByRole('checkbox');
    fireEvent.click(firstRowCheckbox);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        '1 Selected',
      );
    });

    fireEvent.click(bulkSelectButton);

    await waitFor(() => {
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
      expect(screen.queryByTestId('bulk-select-copy')).not.toBeInTheDocument();
    });
  });

  it('displays dataset name without schema prefix correctly', async () => {
    // Test just name case - should display the full name when no schema prefix
    renderChartList(mockUser);

    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });

    const table = screen.getByTestId('listview-table');

    // Wait for chart with simple dataset name to load
    await waitFor(() => {
      expect(
        within(table).getByText(mockCharts[1].slice_name),
      ).toBeInTheDocument();
    });

    // Test mockCharts[1] which has 'sales_data' (no schema prefix)
    const chart1Row = within(table)
      .getByText(mockCharts[1].slice_name)
      .closest('[data-test="table-row"]') as HTMLElement;
    const chart1DatasetLink = within(chart1Row).getByTestId('internal-link');

    // Should display the full name when there's no schema prefix
    expect(chart1DatasetLink).toHaveTextContent('sales_data');
    expect(chart1DatasetLink).toHaveAttribute(
      'href',
      mockCharts[1].datasource_url,
    );
  });
});
