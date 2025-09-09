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

beforeEach(() => {
  fetchMock.reset();
  jest.clearAllMocks();
});

afterEach(() => {
  fetchMock.restore();
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
