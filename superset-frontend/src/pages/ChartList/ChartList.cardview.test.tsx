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
import { isFeatureEnabled } from '@superset-ui/core';
import {
  mockCharts,
  mockHandleResourceExport,
  renderChartList,
  setupMocks,
} from './ChartList.testHelpers';

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

describe('ChartList Card View Tests', () => {
  beforeEach(() => {
    setupMocks();

    // Enable card view as default
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockImplementation(
      (feature: string) => feature === 'LISTVIEWS_DEFAULT_CARD_VIEW',
    );
  });

  afterEach(() => {
    fetchMock.resetHistory();
    fetchMock.restore();
  });

  it('renders ChartList in card view', async () => {
    renderChartList(mockUser);

    // Wait for chart list to load
    await screen.findByTestId('chart-list-view');

    // Verify we're in card view by default (no table should be present)
    expect(screen.queryByTestId('listview-table')).not.toBeInTheDocument();

    // Verify basic card view elements are present
    expect(screen.getByTestId('chart-list-view')).toBeInTheDocument();

    // Verify card view toggle is active (appstore icon should have active class)
    const cardViewToggle = screen.getByRole('img', { name: 'appstore' });
    const cardViewButton = cardViewToggle.closest('[role="button"]');
    expect(cardViewButton).toHaveClass('active');

    // Verify list view toggle is not active
    const listViewToggle = screen.getByRole('img', { name: 'unordered-list' });
    const listViewButton = listViewToggle.closest('[role="button"]');
    expect(listViewButton).not.toHaveClass('active');
  });

  it('switches from card view to list view', async () => {
    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');

    // Verify starting in card view
    expect(screen.queryByTestId('listview-table')).not.toBeInTheDocument();

    // Switch to list view
    const listViewToggle = screen.getByRole('img', { name: 'unordered-list' });
    const listViewButton = listViewToggle.closest('[role="button"]');
    expect(listViewButton).not.toBeNull();
    fireEvent.click(listViewButton!);

    // Verify table is now rendered (indicating list view)
    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });
  });

  it('renders ChartList in card view with thumbnails enabled', async () => {
    // Enable thumbnails feature flag
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockImplementation(
      (feature: string) =>
        feature === 'LISTVIEWS_DEFAULT_CARD_VIEW' || feature === 'THUMBNAILS',
    );

    renderChartList(mockUser);

    // Wait for chart list to load
    await screen.findByTestId('chart-list-view');

    // Wait for chart metadata section to load
    await waitFor(() => {
      expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    });

    // Should show images (thumbnails) in card view when feature is enabled
    const allImages = await screen.findAllByTestId('image-loader');
    expect(allImages).toHaveLength(mockCharts.length);
  });

  it('displays chart data correctly', async () => {
    renderChartList(mockUser);

    // Wait for chart list to load
    await screen.findByTestId('chart-list-view');

    // Wait for cards to render
    await waitFor(() => {
      expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    });

    const testChart = mockCharts[0];

    // 1. Verify chart name appears
    expect(screen.getByText(testChart.slice_name)).toBeInTheDocument();

    // 2. Verify favorite stars exist (one per chart)
    const favoriteStars = screen.getAllByTestId('fave-unfave-icon');
    expect(favoriteStars).toHaveLength(mockCharts.length);

    // 3. Verify last modified date appears (rendered with "Modified" prefix)
    const modifiedText = `Modified ${testChart.changed_on_delta_humanized}`;
    expect(screen.getByText(modifiedText)).toBeInTheDocument();

    // 4. Verify action menu exists (more button for each card)
    const moreButtons = screen.getAllByLabelText('more');
    expect(moreButtons).toHaveLength(mockCharts.length);

    // 5. Verify menu items appear on click
    fireEvent.click(moreButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  it('export chart api called when export button is clicked', async () => {
    renderChartList(mockUser);

    // Wait for cards to load
    await screen.findByTestId('chart-list-view');
    await waitFor(() => {
      expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    });

    // Find and click the more actions button on the first card
    const moreButtons = screen.getAllByLabelText('more');
    fireEvent.click(moreButtons[0]);

    // Wait for dropdown menu and click export
    const exportOption = await screen.findByText('Export');
    fireEvent.click(exportOption);

    // Verify export was called with correct chart ID
    expect(mockHandleResourceExport).toHaveBeenCalledWith(
      'chart',
      [mockCharts[0].id],
      expect.any(Function),
    );
  });

  it('opens edit properties modal when edit button is clicked', async () => {
    renderChartList(mockUser);

    // Wait for cards to load
    await screen.findByTestId('chart-list-view');
    await waitFor(() => {
      expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    });

    // Find and click the more actions button on the first card
    const moreButtons = screen.getAllByLabelText('more');
    fireEvent.click(moreButtons[0]);

    // Wait for dropdown menu and click edit
    const editOption = await screen.findByText('Edit');
    fireEvent.click(editOption);

    // Verify edit modal appears (look for edit form elements)
    await waitFor(() => {
      expect(screen.getByText('Edit Chart Properties')).toBeInTheDocument();
    });
  });

  it('opens delete confirmation when delete button is clicked', async () => {
    renderChartList(mockUser);

    // Wait for cards to load
    await screen.findByTestId('chart-list-view');
    await waitFor(() => {
      expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    });

    // Find and click the more actions button on the first card
    const moreButtons = screen.getAllByLabelText('more');
    fireEvent.click(moreButtons[0]);

    // Wait for dropdown menu and click delete
    const deleteOption = await screen.findByText('Delete');
    fireEvent.click(deleteOption);

    // Verify delete confirmation modal appears
    await waitFor(() => {
      const deleteModal = screen.getByRole('dialog');
      expect(deleteModal).toBeInTheDocument();
      expect(deleteModal).toHaveTextContent(/delete/i);
    });
  });

  it('displays certified badge only for certified charts', async () => {
    renderChartList(mockUser);

    // Wait for cards to load
    await screen.findByTestId('chart-list-view');
    await waitFor(() => {
      expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    });

    // Test certified charts (mockCharts[1] and mockCharts[3] have certified_by)
    const certifiedBadges = screen.getAllByLabelText('certified');

    // Should have exactly 2 certified badges (for charts 1 and 3)
    expect(certifiedBadges).toHaveLength(2);

    // Verify specific certified charts show badges
    // mockCharts[1] is certified by 'Data Team'
    expect(screen.getByText(mockCharts[1].slice_name)).toBeInTheDocument();

    // mockCharts[3] is certified by 'QA Team'
    expect(screen.getByText(mockCharts[3].slice_name)).toBeInTheDocument();
  });

  it('can bulk deselect all charts', async () => {
    renderChartList(mockUser);

    // Wait for cards to load
    await screen.findByTestId('chart-list-view');
    await waitFor(() => {
      expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    });

    // Enable bulk select mode
    const bulkSelectButton = screen.getByTestId('bulk-select');
    fireEvent.click(bulkSelectButton);

    // Wait for bulk select controls to appear
    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-controls')).toBeInTheDocument();
    });

    // In card view, click on individual cards to select them (not checkboxes)
    // Find the first chart name and click on it to select the card
    const firstChartName = screen.getByText(mockCharts[0].slice_name);
    fireEvent.click(firstChartName);

    // Verify first chart is selected
    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        '1 Selected',
      );
    });

    // Click on second chart to add to selection
    const secondChartName = screen.getByText(mockCharts[1].slice_name);
    fireEvent.click(secondChartName);

    // Verify both charts are selected
    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        '2 Selected',
      );
    });

    // Click deselect all
    const deselectAllButton = screen.getByTestId('bulk-select-deselect-all');
    fireEvent.click(deselectAllButton);

    // Verify all charts are deselected
    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        '0 Selected',
      );
    });
  });

  it('can bulk export selected charts', async () => {
    renderChartList(mockUser);

    // Wait for cards to load
    await screen.findByTestId('chart-list-view');
    await waitFor(() => {
      expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    });

    // Enable bulk select mode
    const bulkSelectButton = screen.getByTestId('bulk-select');
    fireEvent.click(bulkSelectButton);

    // Wait for bulk select controls
    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-controls')).toBeInTheDocument();
    });

    // Select charts by clicking on each card (no "Select all" in card view)
    for (let i = 0; i < mockCharts.length; i += 1) {
      const chartName = screen.getByText(mockCharts[i].slice_name);
      fireEvent.click(chartName);
    }

    // Wait for all charts to be selected
    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        `${mockCharts.length} Selected`,
      );
    });

    // Click bulk export button (find by text since there are multiple bulk-select-action buttons)
    const bulkExportButton = screen.getByText('Export');
    fireEvent.click(bulkExportButton);

    // Verify export was called with all chart IDs
    expect(mockHandleResourceExport).toHaveBeenCalledWith(
      'chart',
      mockCharts.map(chart => chart.id),
      expect.any(Function),
    );
  });

  it('can bulk delete selected charts', async () => {
    renderChartList(mockUser);

    // Wait for cards to load
    await screen.findByTestId('chart-list-view');
    await waitFor(() => {
      expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    });

    // Enable bulk select mode
    const bulkSelectButton = screen.getByTestId('bulk-select');
    fireEvent.click(bulkSelectButton);

    // Wait for bulk select controls
    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-controls')).toBeInTheDocument();
    });

    // Select charts by clicking on each card (no "Select all" in card view)
    for (let i = 0; i < mockCharts.length; i += 1) {
      const chartName = screen.getByText(mockCharts[i].slice_name);
      fireEvent.click(chartName);
    }

    // Wait for all charts to be selected
    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        `${mockCharts.length} Selected`,
      );
    });

    // Click bulk delete button (find by text since there are multiple bulk-select-action buttons)
    const bulkDeleteButton = screen.getByText('Delete');
    fireEvent.click(bulkDeleteButton);

    // Verify delete confirmation appears
    await waitFor(() => {
      expect(screen.getByText('Please confirm')).toBeInTheDocument();
    });
  });

  it('can bulk add tags to selected charts', async () => {
    // Enable tagging system for this test
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockImplementation(
      (feature: string) =>
        feature === 'LISTVIEWS_DEFAULT_CARD_VIEW' ||
        feature === 'TAGGING_SYSTEM',
    );

    renderChartList(mockUser);

    // Wait for cards to load
    await screen.findByTestId('chart-list-view');
    await waitFor(() => {
      expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    });

    // Enable bulk select mode
    const bulkSelectButton = screen.getByTestId('bulk-select');
    fireEvent.click(bulkSelectButton);

    // Wait for bulk select controls
    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-controls')).toBeInTheDocument();
    });

    // Select charts by clicking on each card (no "Select all" in card view)
    for (let i = 0; i < mockCharts.length; i += 1) {
      const chartName = screen.getByText(mockCharts[i].slice_name);
      fireEvent.click(chartName);
    }

    // Wait for all charts to be selected
    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        `${mockCharts.length} Selected`,
      );
    });

    // Since TAGGING_SYSTEM is enabled, the tag button should be present
    const bulkTagButton = screen.getByTestId('bulk-select-tag-btn');
    expect(bulkTagButton).toBeInTheDocument();

    fireEvent.click(bulkTagButton);

    // Verify tag modal appears
    await waitFor(() => {
      expect(screen.getByText('Add Tag')).toBeInTheDocument();
    });
  });

  it('exit bulk select by hitting x on bulk select bar', async () => {
    renderChartList(mockUser);

    // Wait for cards to load
    await screen.findByTestId('chart-list-view');
    await waitFor(() => {
      expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    });

    // Enable bulk select mode
    const bulkSelectButton = screen.getByTestId('bulk-select');
    fireEvent.click(bulkSelectButton);

    // Wait for bulk select controls
    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-controls')).toBeInTheDocument();
    });

    // Click the X button to close bulk select (look for close icon in bulk select bar)
    const closeButton = document.querySelector(
      '.ant-alert-close-icon',
    ) as HTMLButtonElement;
    fireEvent.click(closeButton);

    // Verify bulk select controls are gone
    await waitFor(() => {
      expect(
        screen.queryByTestId('bulk-select-controls'),
      ).not.toBeInTheDocument();
    });
  });

  it('exit bulk select by clicking bulk select button again', async () => {
    renderChartList(mockUser);

    // Wait for cards to load
    await screen.findByTestId('chart-list-view');
    await waitFor(() => {
      expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    });

    // Enable bulk select mode
    const bulkSelectButton = screen.getByTestId('bulk-select');
    fireEvent.click(bulkSelectButton);

    // Wait for bulk select controls
    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-controls')).toBeInTheDocument();
    });

    // Click bulk select button again to exit
    fireEvent.click(bulkSelectButton);

    // Verify bulk select controls are gone
    await waitFor(() => {
      expect(
        screen.queryByTestId('bulk-select-controls'),
      ).not.toBeInTheDocument();
    });
  });

  it('card click behavior changes in bulk select mode', async () => {
    renderChartList(mockUser);

    // Wait for cards to load
    await screen.findByTestId('chart-list-view');
    await waitFor(() => {
      expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
    });

    // In normal mode, clicking card should navigate (but we can't test navigation in this setup)
    // Instead, verify bulk select is not active initially
    expect(
      screen.queryByTestId('bulk-select-controls'),
    ).not.toBeInTheDocument();

    // Enable bulk select mode
    const bulkSelectButton = screen.getByTestId('bulk-select');
    fireEvent.click(bulkSelectButton);

    // Wait for bulk select controls
    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-controls')).toBeInTheDocument();
    });

    // Now clicking on cards should select them instead of navigating
    const firstChartName = screen.getByText(mockCharts[0].slice_name);
    fireEvent.click(firstChartName);

    // Verify chart was selected (not navigated)
    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        '1 Selected',
      );
    });

    // Clicking the same card again should deselect it
    fireEvent.click(firstChartName);

    // Verify chart was deselected
    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        '0 Selected',
      );
    });
  });

  it('renders sort dropdown in card view', async () => {
    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');

    // Wait for the component to switch to card view (due to feature flag)
    await waitFor(() => {
      expect(screen.queryByTestId('listview-table')).not.toBeInTheDocument();
    });

    // Verify basic card view elements are present
    expect(screen.getByTestId('chart-list-view')).toBeInTheDocument();

    // Find Sort dropdown using its data-test attribute (CardSortSelect component)
    const sortFilter = screen.getByTestId('card-sort-select');

    expect(sortFilter).toBeInTheDocument();
    expect(sortFilter).toBeVisible();
    expect(sortFilter).toBeEnabled();
  });
});
