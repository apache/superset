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
import {
  createWrapper,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import DatasetUsageTab from '.';

const mockChartsResponse = {
  result: [
    {
      id: 1,
      slice_name: 'Test Chart 1',
      url: '/explore/1/',
      certified_by: 'John Doe',
      certification_details: 'Certified for production use',
      description: 'A test chart',
      owners: [
        {
          first_name: 'Jane',
          last_name: 'Smith',
          id: 1,
        },
      ],
      changed_on_delta_humanized: '2 days ago',
      changed_on: '2024-08-11T10:00:00Z',
      changed_on_ts: new Date('2024-08-11T10:00:00Z').getTime(),
      changed_by: {
        first_name: 'Jane',
        last_name: 'Smith',
        id: 1,
      },
      dashboards: [
        {
          id: 1,
          dashboard_title: 'Test Dashboard',
          url: '/dashboard/1/',
        },
      ],
    },
    {
      id: 2,
      slice_name: 'Test Chart 2',
      url: '/explore/2/',
      owners: [
        {
          first_name: 'Bob',
          last_name: 'Johnson',
          id: 2,
        },
      ],
      changed_on_delta_humanized: '1 day ago',
      changed_on: '2024-08-12T10:00:00Z',
      changed_on_ts: new Date('2024-08-12T10:00:00Z').getTime(),
      changed_by: {
        first_name: 'Bob',
        last_name: 'Johnson',
        id: 2,
      },
      dashboards: [],
    },
  ],
  count: 2,
  ids: [1, 2],
};

const setupTest = (props = {}) => {
  const mockOnFetchCharts = jest.fn(() =>
    Promise.resolve({
      charts: mockChartsResponse.result,
      count: mockChartsResponse.count,
      ids: mockChartsResponse.ids,
    }),
  );

  const defaultProps = {
    datasourceId: 123,
    charts: mockChartsResponse.result,
    totalCount: mockChartsResponse.count,
    onFetchCharts: mockOnFetchCharts,
    addDangerToast: jest.fn(),
    ...props,
  };

  return render(<DatasetUsageTab {...defaultProps} />, {
    wrapper: createWrapper({
      useRedux: true,
      useRouter: true,
    }),
  });
};

// Store original scrollTo to restore after tests
let originalScrollTo: typeof Element.prototype.scrollTo;

beforeAll(() => {
  // Capture original scrollTo implementation once before all tests
  originalScrollTo = Element.prototype.scrollTo;
});

beforeEach(() => {
  fetchMock.clearHistory().removeRoutes();
  jest.clearAllMocks();
  // Mock scrollTo for all tests
  Element.prototype.scrollTo = jest.fn();
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  // Restore original scrollTo implementation after each test
  Element.prototype.scrollTo = originalScrollTo;
  // Restore console.error if it was spied on
  if (jest.isMockFunction(console.error)) {
    (console.error as jest.Mock).mockRestore();
  }
});

test('renders empty state when no charts provided', () => {
  setupTest({ charts: [], totalCount: 0 });

  expect(screen.getByText('No items')).toBeInTheDocument();
});

test('shows no items immediately when empty array provided (no loading flicker)', () => {
  setupTest({ charts: [] });

  expect(screen.getByText('No items')).toBeInTheDocument();
  expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
});

test('displays charts using the dataset', async () => {
  setupTest();

  await waitFor(() => {
    expect(screen.getByText('Test Chart 1')).toBeInTheDocument();
    expect(screen.getByText('Test Chart 2')).toBeInTheDocument();
  });
});

test('displays chart information correctly', async () => {
  fetchMock.get('glob:*/api/v1/chart/*', mockChartsResponse);
  setupTest();

  await waitFor(() => {
    expect(screen.getByText('Test Chart 1')).toBeInTheDocument();
    expect(screen.getByText('Test Chart 2')).toBeInTheDocument();

    expect(screen.getByText('2 days ago')).toBeInTheDocument();
    expect(screen.getByText('1 day ago')).toBeInTheDocument();
  });
});

test('handles empty response correctly', async () => {
  fetchMock.get('glob:*/api/v1/chart/*', { result: [], count: 0 });
  setupTest({ charts: [] });

  await waitFor(() => {
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
  });

  expect(screen.getByText('No items')).toBeInTheDocument();
  expect(screen.queryByText('Test Chart 1')).not.toBeInTheDocument();
});

test('renders correct column headers', async () => {
  fetchMock.get('glob:*/api/v1/chart/*', mockChartsResponse);
  setupTest();

  await waitFor(() => {
    const chartHeader = screen
      .getAllByText('Chart')
      .find(el => el.closest('th'));
    const ownersHeader = screen
      .getAllByText('Chart owners')
      .find(el => el.closest('th'));
    const lastModifiedHeader = screen
      .getAllByText('Last modified')
      .find(el => el.closest('th'));
    const dashboardHeader = screen
      .getAllByText('Dashboard usage')
      .find(el => el.closest('th'));

    expect(chartHeader).toBeInTheDocument();
    expect(ownersHeader).toBeInTheDocument();
    expect(lastModifiedHeader).toBeInTheDocument();
    expect(dashboardHeader).toBeInTheDocument();
  });
});

test('opens chart links in new tabs', async () => {
  fetchMock.get('glob:*/api/v1/chart/*', mockChartsResponse);
  setupTest();

  await waitFor(() => {
    const chartLink = screen.getByText('Test Chart 1').closest('a');
    expect(chartLink).toHaveAttribute('target', '_blank');
  });
});

test('displays data in correct order (last modified desc)', async () => {
  setupTest();

  await waitFor(() => {
    expect(screen.getByText('Test Chart 1')).toBeInTheDocument();
    expect(screen.getByText('Test Chart 2')).toBeInTheDocument();
  });
});

test('enables sorting for Chart and Last modified columns', async () => {
  setupTest();
  await waitFor(() => {
    const chartHeader = screen
      .getAllByText('Chart')
      .find(el => el.closest('th'))
      ?.closest('th');

    const lastModifiedHeader = screen
      .getAllByText('Last modified')
      .find(el => el.closest('th'))
      ?.closest('th');

    const ownersHeader = screen
      .getAllByText('Chart owners')
      .find(el => el.closest('th'))
      ?.closest('th');

    const dashboardHeader = screen
      .getAllByText('Dashboard usage')
      .find(el => el.closest('th'))
      ?.closest('th');

    expect(chartHeader).toHaveClass('ant-table-column-has-sorters');
    expect(lastModifiedHeader).toHaveClass('ant-table-column-has-sorters');
    expect(ownersHeader).not.toHaveClass('ant-table-column-has-sorters');
    expect(dashboardHeader).not.toHaveClass('ant-table-column-has-sorters');
  });
});

test('shows loading state during pagination fetch', async () => {
  let resolvePromise: (value: any) => void;
  const delayedPromise = new Promise(resolve => {
    resolvePromise = resolve;
  });

  const mockOnFetchCharts = jest.fn(() => delayedPromise);

  // Start with multiple pages
  setupTest({
    onFetchCharts: mockOnFetchCharts,
    totalCount: 100,
  });

  // Initial render - no loading
  expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();

  // Find next page button
  const nextButton = screen.getByTitle('Next Page');

  await userEvent.click(nextButton);

  // Should show loading state
  await waitFor(() => {
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  // Resolve the promise
  resolvePromise!({
    charts: mockChartsResponse.result,
    count: 100,
    ids: [1, 2],
  });

  // Loading should disappear
  await waitFor(() => {
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
  });
});

test('calls onFetchCharts with correct pagination parameters', async () => {
  const mockOnFetchCharts = jest.fn(() =>
    Promise.resolve({
      charts: mockChartsResponse.result,
      count: 100,
      ids: [1, 2],
    }),
  );

  setupTest({
    onFetchCharts: mockOnFetchCharts,
    totalCount: 100,
  });

  const nextButton = screen.getByTitle('Next Page');

  await userEvent.click(nextButton);

  await waitFor(() => {
    expect(mockOnFetchCharts).toHaveBeenCalledWith(
      2, // page
      25, // pageSize
      'changed_on_delta_humanized', // sortColumn
      'desc', // sortDirection
    );
  });
});

test('shows error toast when fetch fails', async () => {
  const mockOnFetchCharts = jest.fn(() =>
    Promise.reject(new Error('Network error')),
  );
  const mockAddDangerToast = jest.fn();

  setupTest({
    onFetchCharts: mockOnFetchCharts,
    addDangerToast: mockAddDangerToast,
    totalCount: 100,
  });

  const nextButton = screen.getByTitle('Next Page');

  await userEvent.click(nextButton);

  await waitFor(() => {
    expect(mockAddDangerToast).toHaveBeenCalledWith('Error fetching charts');
  });

  // Loading state should be cleared
  expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
});

test('handles slow network without race condition', async () => {
  let resolvePromise: (value: any) => void;
  const slowPromise = new Promise(resolve => {
    resolvePromise = resolve;
  });

  const mockOnFetchCharts = jest.fn(() => slowPromise);

  setupTest({
    onFetchCharts: mockOnFetchCharts,
    totalCount: 100,
  });

  const nextButton = screen.getByTitle('Next Page');

  await userEvent.click(nextButton);

  // Should be loading
  await waitFor(() => {
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  // Should still be loading (data hasn't arrived)
  expect(screen.getByLabelText('Loading')).toBeInTheDocument();

  // Now resolve the promise
  resolvePromise!({
    charts: mockChartsResponse.result,
    count: 100,
    ids: [1, 2],
  });

  // Wait for loading to complete
  await waitFor(() => {
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
  });
});

test('scrolls to top after data loads, not before', async () => {
  // Use the global scrollTo mock
  const scrollToMock = Element.prototype.scrollTo as jest.Mock;

  let resolvePromise: (value: any) => void;
  const delayedPromise = new Promise(resolve => {
    resolvePromise = resolve;
  });

  const mockOnFetchCharts = jest.fn(() => delayedPromise);

  setupTest({
    onFetchCharts: mockOnFetchCharts,
    totalCount: 100,
  });

  const nextButton = screen.getByTitle('Next Page');

  await userEvent.click(nextButton);

  // Should be loading
  await waitFor(() => {
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  // Scroll should NOT have been called yet (data still loading)
  expect(scrollToMock).not.toHaveBeenCalled();

  // Resolve the promise
  resolvePromise!({
    charts: mockChartsResponse.result,
    count: 100,
    ids: [1, 2],
  });

  // Wait for loading to complete
  await waitFor(() => {
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
  });

  // Scroll should be called after data loads (with requestAnimationFrame)
  await waitFor(() => {
    expect(scrollToMock).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });
});

test('does not scroll on initial mount, only on page change', async () => {
  // Use the global scrollTo mock
  const scrollToMock = Element.prototype.scrollTo as jest.Mock;

  const mockOnFetchCharts = jest.fn(() =>
    Promise.resolve({
      charts: mockChartsResponse.result,
      count: 2,
      ids: [1, 2],
    }),
  );

  setupTest({ onFetchCharts: mockOnFetchCharts });

  // Wait for initial render
  await waitFor(() => {
    expect(screen.getByText('Test Chart 1')).toBeInTheDocument();
  });

  // Scroll should not have been called on mount
  expect(scrollToMock).not.toHaveBeenCalled();
});

test('cleans up animation frame on unmount during loading', async () => {
  const cancelAnimationFrameSpy = jest.spyOn(window, 'cancelAnimationFrame');

  let resolvePromise: (value: any) => void;
  const delayedPromise = new Promise(resolve => {
    resolvePromise = resolve;
  });

  const mockOnFetchCharts = jest.fn(() => delayedPromise);

  const { unmount } = setupTest({
    onFetchCharts: mockOnFetchCharts,
    totalCount: 100,
  });

  const nextButton = screen.getByTitle('Next Page');

  await userEvent.click(nextButton);

  // Should be loading
  await waitFor(() => {
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  // Resolve promise to trigger scroll effect
  resolvePromise!({
    charts: mockChartsResponse.result,
    count: 100,
    ids: [1, 2],
  });

  // Wait for loading to complete (which queues requestAnimationFrame)
  await waitFor(() => {
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
  });

  // Unmount before animation frame fires
  unmount();

  // Cleanup should have cancelled the animation frame
  expect(cancelAnimationFrameSpy).toHaveBeenCalled();

  cancelAnimationFrameSpy.mockRestore();
});

test('handles AbortError without setState after unmount', async () => {
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

  let rejectPromise: (reason?: any) => void;
  const abortedPromise = new Promise((_, reject) => {
    rejectPromise = reject;
  });

  const mockOnFetchCharts = jest.fn(() => abortedPromise);

  const { unmount } = setupTest({
    onFetchCharts: mockOnFetchCharts,
    totalCount: 100,
  });

  const nextButton = screen.getByTitle('Next Page');
  await userEvent.click(nextButton);

  // Should be loading
  await waitFor(() => {
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  // Unmount while loading
  unmount();

  // Reject with AbortError after unmount
  const abortError = new Error('The operation was aborted');
  abortError.name = 'AbortError';
  rejectPromise!(abortError);

  // Flush pending promises and animation frames
  await new Promise(resolve => setTimeout(resolve, 0));

  // CRITICAL: No setState warnings
  expect(consoleErrorSpy).not.toHaveBeenCalledWith(
    expect.stringContaining('setState'),
  );
  expect(consoleErrorSpy).not.toHaveBeenCalledWith(
    expect.stringContaining('unmounted component'),
  );

  consoleErrorSpy.mockRestore();
});

test('can search charts by chart name', async () => {
  setupTest();

  await waitFor(() => {
    expect(screen.getByText('Test Chart 1')).toBeInTheDocument();
    expect(screen.getByText('Test Chart 2')).toBeInTheDocument();
  });

  const searchInput = screen.getByPlaceholderText(
    'Search charts by name, owner, or dashboard',
  );
  expect(searchInput).toBeInTheDocument();

  await userEvent.type(searchInput, 'Chart 1');

  await waitFor(() => {
    expect(screen.getByText('Test Chart 1')).toBeInTheDocument();
    expect(screen.queryByText('Test Chart 2')).not.toBeInTheDocument();
  });

  await userEvent.clear(searchInput);

  await waitFor(() => {
    expect(screen.getByText('Test Chart 1')).toBeInTheDocument();
    expect(screen.getByText('Test Chart 2')).toBeInTheDocument();
  });
});

test('can search charts by owner name', async () => {
  setupTest();

  await waitFor(() => {
    expect(screen.getByText('Test Chart 1')).toBeInTheDocument();
  });

  const searchInput = screen.getByPlaceholderText(
    'Search charts by name, owner, or dashboard',
  );

  await userEvent.type(searchInput, 'Bob');

  await waitFor(() => {
    expect(screen.queryByText('Test Chart 1')).not.toBeInTheDocument();
    expect(screen.getByText('Test Chart 2')).toBeInTheDocument();
  });
});

test('can search charts by dashboard title', async () => {
  setupTest();

  await waitFor(() => {
    expect(screen.getByText('Test Chart 1')).toBeInTheDocument();
  });

  const searchInput = screen.getByPlaceholderText(
    'Search charts by name, owner, or dashboard',
  );

  await userEvent.type(searchInput, 'Test Dashboard');

  await waitFor(() => {
    expect(screen.getByText('Test Chart 1')).toBeInTheDocument();
    expect(screen.queryByText('Test Chart 2')).not.toBeInTheDocument();
  });
});

test('chart search is case-insensitive', async () => {
  setupTest();

  await waitFor(() => {
    expect(screen.getByText('Test Chart 1')).toBeInTheDocument();
  });

  const searchInput = screen.getByPlaceholderText(
    'Search charts by name, owner, or dashboard',
  );

  await userEvent.type(searchInput, 'CHART 1');

  await waitFor(() => {
    expect(screen.getByText('Test Chart 1')).toBeInTheDocument();
    expect(screen.queryByText('Test Chart 2')).not.toBeInTheDocument();
  });
});

test('shows No items when search has no results', async () => {
  setupTest();

  await waitFor(() => {
    expect(screen.getByText('Test Chart 1')).toBeInTheDocument();
  });

  const searchInput = screen.getByPlaceholderText(
    'Search charts by name, owner, or dashboard',
  );

  await userEvent.type(searchInput, 'nonexistent chart');

  await waitFor(() => {
    expect(screen.queryByText('Test Chart 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Test Chart 2')).not.toBeInTheDocument();
    expect(screen.getByText('No items')).toBeInTheDocument();
  });
});

test('hides pagination when searching and restores it when cleared', async () => {
  setupTest();

  await waitFor(() => {
    expect(screen.getByText('Test Chart 1')).toBeInTheDocument();
    expect(screen.getByText('Test Chart 2')).toBeInTheDocument();
  });

  // Pagination is visible when not searching (check for page number listitem)
  expect(screen.getByTitle('1')).toBeInTheDocument();

  const searchInput = screen.getByPlaceholderText(
    'Search charts by name, owner, or dashboard',
  );

  await userEvent.type(searchInput, 'Chart 1');

  // Only matching chart is shown
  await waitFor(() => {
    expect(screen.getByText('Test Chart 1')).toBeInTheDocument();
    expect(screen.queryByText('Test Chart 2')).not.toBeInTheDocument();
  });

  // Pagination is hidden while searching
  expect(screen.queryByTitle('Next Page')).not.toBeInTheDocument();

  await userEvent.clear(searchInput);

  // Both charts are visible again after clearing search
  await waitFor(() => {
    expect(screen.getByText('Test Chart 1')).toBeInTheDocument();
    expect(screen.getByText('Test Chart 2')).toBeInTheDocument();
  });

  // Pagination is restored
  expect(screen.getByTitle('1')).toBeInTheDocument();
});
