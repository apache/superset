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
  act,
  createWrapper,
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
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

// Store original scrollTo to restore after tests
let originalScrollTo: typeof Element.prototype.scrollTo;

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

  const result = render(<DatasetUsageTab {...defaultProps} />, {
    wrapper: createWrapper({
      useRedux: true,
      useRouter: true,
    }),
  });

  return { ...result, mockOnFetchCharts };
};

beforeEach(() => {
  fetchMock.reset();
  jest.clearAllMocks();

  // Save original scrollTo and mock it for JSDOM compatibility
  originalScrollTo = Element.prototype.scrollTo;
  Object.defineProperty(Element.prototype, 'scrollTo', {
    value: jest.fn(),
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  fetchMock.restore();

  // Restore real timers in case a test with fakeTimers failed mid-test
  jest.useRealTimers();

  // Restore original scrollTo to avoid test pollution
  if (originalScrollTo) {
    Object.defineProperty(Element.prototype, 'scrollTo', {
      value: originalScrollTo,
      configurable: true,
      writable: true,
    });
  } else {
    delete (Element.prototype as any).scrollTo;
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
    expect(screen.getByText('Chart')).toBeInTheDocument();
    expect(screen.getByText('Chart owners')).toBeInTheDocument();
    expect(screen.getByText('Last modified')).toBeInTheDocument();
    expect(screen.getByText('Dashboard usage')).toBeInTheDocument();
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
    const chartHeader = screen.getByText('Chart').closest('th');
    const lastModifiedHeader = screen.getByText('Last modified').closest('th');
    const ownersHeader = screen.getByText('Chart owners').closest('th');
    const dashboardHeader = screen.getByText('Dashboard usage').closest('th');

    expect(chartHeader).toHaveClass('ant-table-column-has-sorters');
    expect(lastModifiedHeader).toHaveClass('ant-table-column-has-sorters');

    expect(ownersHeader).not.toHaveClass('ant-table-column-has-sorters');
    expect(dashboardHeader).not.toHaveClass('ant-table-column-has-sorters');
  });
});

test('clears scroll timeout on unmount to prevent async updates', async () => {
  jest.useFakeTimers();

  // Reuse the scrollTo mock from beforeEach
  const scrollToMock = Element.prototype.scrollTo as jest.Mock;
  scrollToMock.mockClear();

  // Need enough charts to trigger pagination (PAGE_SIZE = 25)
  const manyCharts = Array.from({ length: 51 }, (_, i) => ({
    id: i + 1,
    slice_name: `Test Chart ${i + 1}`,
    url: `/explore/${i + 1}/`,
    owners: [],
    changed_on_delta_humanized: '1 day ago',
    changed_by: null,
    dashboards: [],
  }));

  const { unmount, mockOnFetchCharts } = setupTest({
    charts: manyCharts,
    totalCount: 51,
  });

  // Wait for pagination to appear
  await waitFor(() => {
    // Ant Design wires click handlers to the <a> element inside the <li>
    expect(screen.getByRole('link', { name: '2' })).toBeInTheDocument();
  });

  // Trigger pagination change which starts a 100ms setTimeout
  const page2Link = screen.getByRole('link', { name: '2' });
  fireEvent.click(page2Link);

  // Verify pagination was triggered
  expect(mockOnFetchCharts).toHaveBeenCalledWith(2, 25, expect.any(String), expect.any(String));

  // Unmount before timeout fires
  unmount();

  // Fast-forward time - scroll should NOT be called because timeout was cleared
  act(() => {
    jest.runAllTimers();
  });

  // Critical assertion: scrollTo should never be called after unmount
  expect(scrollToMock).not.toHaveBeenCalled();
});

test('clears pending scroll timeout on rapid pagination clicks', async () => {
  jest.useFakeTimers();

  // Reuse the scrollTo mock from beforeEach
  const scrollToMock = Element.prototype.scrollTo as jest.Mock;
  scrollToMock.mockClear();

  // Need enough charts to trigger pagination (PAGE_SIZE = 25)
  const manyCharts = Array.from({ length: 60 }, (_, i) => ({
    id: i + 1,
    slice_name: `Test Chart ${i + 1}`,
    url: `/explore/${i + 1}/`,
    owners: [],
    changed_on_delta_humanized: '1 day ago',
    changed_by: null,
    dashboards: [],
  }));

  const { mockOnFetchCharts } = setupTest({
    charts: manyCharts,
    totalCount: 60,
  });

  // Wait for pagination to appear
  await waitFor(() => {
    // Ant Design wires click handlers to the <a> element inside the <li>
    expect(screen.getByRole('link', { name: '2' })).toBeInTheDocument();
  });

  // Simulate rapid pagination clicks
  const page2Link = screen.getByRole('link', { name: '2' });
  const page3Link = screen.getByRole('link', { name: '3' });

  fireEvent.click(page2Link); // Page 2 - starts timeout #1
  expect(mockOnFetchCharts).toHaveBeenCalledWith(2, 25, expect.any(String), expect.any(String));

  act(() => {
    jest.advanceTimersByTime(50); // Halfway through timeout #1
  });

  fireEvent.click(page3Link); // Page 3 - should clear timeout #1, start timeout #2
  expect(mockOnFetchCharts).toHaveBeenCalledWith(3, 25, expect.any(String), expect.any(String));

  // Only the second timeout should execute
  act(() => {
    jest.runAllTimers();
  });

  // Should only scroll once (second timeout), not twice
  expect(scrollToMock).toHaveBeenCalledTimes(1);
  expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
});

test('scrolls table to top after pagination with delay', async () => {
  jest.useFakeTimers();

  // Reuse the scrollTo mock from beforeEach
  const scrollToMock = Element.prototype.scrollTo as jest.Mock;
  scrollToMock.mockClear();

  // Need enough charts to trigger pagination (PAGE_SIZE = 25)
  const manyCharts = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    slice_name: `Test Chart ${i + 1}`,
    url: `/explore/${i + 1}/`,
    owners: [],
    changed_on_delta_humanized: '1 day ago',
    changed_by: null,
    dashboards: [],
  }));

  const { mockOnFetchCharts } = setupTest({
    charts: manyCharts,
    totalCount: 30,
  });

  // Wait for pagination to appear, then trigger it
  await waitFor(() => {
    // Ant Design wires click handlers to the <a> element inside the <li>
    expect(screen.getByRole('link', { name: '2' })).toBeInTheDocument();
  });

  // Click page 2
  const page2Link = screen.getByRole('link', { name: '2' });
  fireEvent.click(page2Link);

  // Verify pagination was triggered with correct page number
  expect(mockOnFetchCharts).toHaveBeenCalledWith(2, 25, expect.any(String), expect.any(String));

  // Scroll should not happen immediately
  expect(scrollToMock).not.toHaveBeenCalled();

  // After 100ms timeout, scroll should execute
  act(() => {
    jest.advanceTimersByTime(100);
  });

  expect(scrollToMock).toHaveBeenCalledWith({
    top: 0,
    behavior: 'smooth',
  });
});
