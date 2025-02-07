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
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import { ChartListChart, getMockChart } from 'spec/fixtures/mockCharts';
import ToastContainer from 'src/components/MessageToasts/ToastContainer';
import DatasetUsage from '.';

const DEFAULT_DATASET_ID = '1';
const DEFAULT_ORDER_COLUMN = 'last_saved_at';
const DEFAULT_ORDER_DIRECTION = 'desc';
const DEFAULT_PAGE = 0;
const DEFAULT_PAGE_SIZE = 25;

const getChartResponse = (result: ChartListChart[]) => ({
  count: result.length,
  result,
});

const CHARTS_ENDPOINT = 'glob:*/api/v1/chart/?*';
const mockChartsFetch = (response: fetchMock.MockResponse) => {
  fetchMock.reset();
  fetchMock.get('glob:*/api/v1/chart/_info?*', {
    permissions: ['can_export', 'can_read', 'can_write'],
  });

  fetchMock.get(CHARTS_ENDPOINT, response);
};

const renderDatasetUsage = () =>
  render(
    <>
      <DatasetUsage datasetId={DEFAULT_DATASET_ID} />
      <ToastContainer />
    </>,
    { useRedux: true, useRouter: true },
  );

const expectLastChartRequest = (params?: {
  datasetId?: string;
  orderColumn?: string;
  orderDirection?: 'desc' | 'asc';
  page?: number;
  pageSize?: number;
}) => {
  const { datasetId, orderColumn, orderDirection, page, pageSize } = {
    datasetId: DEFAULT_DATASET_ID,
    orderColumn: DEFAULT_ORDER_COLUMN,
    orderDirection: DEFAULT_ORDER_DIRECTION,
    page: DEFAULT_PAGE,
    pageSize: DEFAULT_PAGE_SIZE,
    ...(params || {}),
  };

  const calls = fetchMock.calls(CHARTS_ENDPOINT);
  expect(calls.length).toBeGreaterThan(0);
  const lastChartRequestUrl = calls[calls.length - 1][0];
  expect(lastChartRequestUrl).toMatch(
    new RegExp(`col:datasource_id,opr:eq,value:%27${datasetId}%27`),
  );

  expect(lastChartRequestUrl).toMatch(
    new RegExp(`order_column:${orderColumn}`),
  );

  expect(lastChartRequestUrl).toMatch(
    new RegExp(`order_direction:${orderDirection}`),
  );

  expect(lastChartRequestUrl).toMatch(new RegExp(`page:${page}`));
  expect(lastChartRequestUrl).toMatch(new RegExp(`page_size:${pageSize}`));
};

test('shows loading state', async () => {
  mockChartsFetch(
    new Promise(resolve =>
      setTimeout(() => resolve(getChartResponse([])), 250),
    ),
  );

  renderDatasetUsage();

  const loadingIndicator = await screen.findByRole('status', {
    name: /loading/i,
  });

  expect(loadingIndicator).toBeVisible();
});

test('shows error state', async () => {
  mockChartsFetch(500);
  renderDatasetUsage();

  const errorMessage = await screen.findByText(
    /an error occurred while fetching charts/i,
  );

  expect(errorMessage).toBeInTheDocument();
});

test('shows empty state', async () => {
  mockChartsFetch(getChartResponse([]));
  renderDatasetUsage();

  const noChartsTitle = await screen.findByText(/no charts/i);
  const noChartsDescription = screen.getByText(
    /this dataset is not used to power any charts\./i,
  );

  expect(noChartsTitle).toBeVisible();
  expect(noChartsDescription).toBeVisible();
  expect(fetchMock.calls(CHARTS_ENDPOINT)).toHaveLength(1);
  expectLastChartRequest();
});

test('show and sort by chart title', async () => {
  mockChartsFetch(
    getChartResponse([
      getMockChart({ id: 1, slice_name: 'Sample A' }),
      getMockChart({ id: 2, slice_name: 'Sample C' }),
      getMockChart({ id: 3, slice_name: 'Sample B' }),
    ]),
  );

  renderDatasetUsage();

  const chartNameColumnHeader = screen.getByText('Chart');
  const chartNameLinks = await screen.findAllByRole('link', {
    name: /sample/i,
  });

  // Default sort
  expect(chartNameLinks).toHaveLength(3);
  expect(chartNameLinks[0]).toHaveTextContent('Sample A');
  expect(chartNameLinks[0]).toHaveAttribute('href', '/explore/?slice_id=1');
  expect(chartNameLinks[1]).toHaveTextContent('Sample C');
  expect(chartNameLinks[1]).toHaveAttribute('href', '/explore/?slice_id=2');
  expect(chartNameLinks[2]).toHaveTextContent('Sample B');
  expect(chartNameLinks[2]).toHaveAttribute('href', '/explore/?slice_id=3');
  expectLastChartRequest();

  // Sort by name ascending
  userEvent.click(chartNameColumnHeader);
  waitFor(() => {
    expectLastChartRequest({
      orderColumn: 'slice_name',
      orderDirection: 'asc',
    });
  });

  // Sort by name descending
  userEvent.click(chartNameColumnHeader);
  waitFor(() => {
    expectLastChartRequest({
      orderColumn: 'slice_name',
      orderDirection: 'desc',
    });
  });
});

test('show chart owners', async () => {
  mockChartsFetch(
    getChartResponse([
      getMockChart({
        id: 1,
        owners: [
          { id: 1, first_name: 'John', last_name: 'Doe', username: 'j1' },
          { id: 2, first_name: 'Jane', last_name: 'Doe', username: 'j2' },
        ],
      }),
      getMockChart({ id: 2 }),
      getMockChart({
        id: 3,
        owners: [
          { id: 3, first_name: 'John', last_name: 'Doe', username: 'j1' },
        ],
      }),
    ]),
  );

  renderDatasetUsage();

  const chartOwners = await screen.findAllByText(/doe/i);

  expect(chartOwners).toHaveLength(3);
  expect(chartOwners[0]).toHaveTextContent('John Doe');
  expect(chartOwners[1]).toHaveTextContent('Jane Doe');
  expect(chartOwners[0].parentNode).toBe(chartOwners[1].parentNode);
  expect(chartOwners[2]).toHaveTextContent('John Doe');
  expect(chartOwners[2].parentNode).not.toBe(chartOwners[0].parentNode);
  expect(chartOwners[2].parentNode).not.toBe(chartOwners[1].parentNode);
  expectLastChartRequest();
});

const getDate = (msAgo: number) => {
  const date = new Date();
  date.setMilliseconds(date.getMilliseconds() - msAgo);
  return date;
};

test('show and sort by chart last modified', async () => {
  mockChartsFetch(
    getChartResponse([
      getMockChart({ id: 2, last_saved_at: getDate(10000).toISOString() }),
      getMockChart({ id: 1, last_saved_at: getDate(1000000).toISOString() }),
      getMockChart({ id: 3, last_saved_at: getDate(100000000).toISOString() }),
    ]),
  );

  renderDatasetUsage();

  const chartLastModifiedColumnHeader = screen.getByText('Chart last modified');
  const chartLastModifiedValues = await screen.findAllByText(
    /a few seconds ago|17 minutes ago|a day ago/i,
  );

  // Default sort
  expect(chartLastModifiedValues).toHaveLength(3);
  expect(chartLastModifiedValues[0]).toHaveTextContent('a few seconds ago');
  expect(chartLastModifiedValues[1]).toHaveTextContent('17 minutes ago');
  expect(chartLastModifiedValues[2]).toHaveTextContent('a day ago');
  expectLastChartRequest();

  // Sort by last modified ascending
  userEvent.click(chartLastModifiedColumnHeader);
  waitFor(() => {
    expectLastChartRequest({ orderDirection: 'asc' });
  });

  // Sort by last modified descending
  userEvent.click(chartLastModifiedColumnHeader);
  waitFor(() => {
    expectLastChartRequest({ orderDirection: 'desc' });
  });
});

test('show and sort by chart last modified by', async () => {
  mockChartsFetch(
    getChartResponse([
      getMockChart({
        id: 2,
        last_saved_by: { id: 1, first_name: 'John', last_name: 'Doe' },
      }),
      getMockChart({
        id: 1,
        last_saved_by: null,
      }),
      getMockChart({
        id: 3,
        last_saved_by: { id: 2, first_name: 'Jane', last_name: 'Doe' },
      }),
    ]),
  );

  renderDatasetUsage();

  const chartLastModifiedByColumnHeader = screen.getByText(
    'Chart last modified by',
  );

  const chartLastModifiedByValues = await screen.findAllByText(/doe/i);

  // Default sort
  expect(chartLastModifiedByValues).toHaveLength(2);
  expect(chartLastModifiedByValues[0]).toHaveTextContent('John Doe');
  expect(chartLastModifiedByValues[1]).toHaveTextContent('Jane Doe');
  expectLastChartRequest();

  // Sort by last modified ascending
  userEvent.click(chartLastModifiedByColumnHeader);
  waitFor(() => {
    expectLastChartRequest({ orderDirection: 'asc' });
  });

  // Sort by last modified descending
  userEvent.click(chartLastModifiedByColumnHeader);
  waitFor(() => {
    expectLastChartRequest({ orderDirection: 'desc' });
  });
});

test('show chart dashboards', async () => {
  mockChartsFetch(
    getChartResponse([
      getMockChart({
        id: 1,
        dashboards: [
          { id: 1, dashboard_title: 'Sample dashboard A' },
          { id: 2, dashboard_title: 'Sample dashboard B' },
        ],
      }),
      getMockChart({ id: 2 }),
      getMockChart({
        id: 3,
        dashboards: [{ id: 3, dashboard_title: 'Sample dashboard C' }],
      }),
    ]),
  );

  renderDatasetUsage();

  const chartDashboards = await screen.findAllByRole('link', {
    name: /sample dashboard/i,
  });

  expect(chartDashboards).toHaveLength(3);
  expect(chartDashboards[0]).toHaveTextContent('Sample dashboard A');
  expect(chartDashboards[0]).toHaveAttribute('href', '/superset/dashboard/1');
  expect(chartDashboards[1]).toHaveTextContent('Sample dashboard B');
  expect(chartDashboards[1]).toHaveAttribute('href', '/superset/dashboard/2');
  expect(chartDashboards[0].closest('.ant-table-cell')).toBe(
    chartDashboards[1].closest('.ant-table-cell'),
  );

  expect(chartDashboards[2]).toHaveTextContent('Sample dashboard C');
  expect(chartDashboards[2]).toHaveAttribute('href', '/superset/dashboard/3');
  expect(chartDashboards[2].closest('.ant-table-cell')).not.toBe(
    chartDashboards[0].closest('.ant-table-cell'),
  );

  expect(chartDashboards[2].closest('.ant-table-cell')).not.toBe(
    chartDashboards[1].closest('.ant-table-cell'),
  );

  expectLastChartRequest();

  expect(
    screen.queryByRole('button', {
      name: /right/i,
    }),
  ).not.toBeInTheDocument();
});

test('paginates', async () => {
  const charts = [];
  for (let i = 0; i < 65; i += 1) {
    charts.push(
      getMockChart({
        id: i + 1,
        slice_name: `Sample chart ${i + 1}`,
      }),
    );
  }

  mockChartsFetch(getChartResponse(charts));
  renderDatasetUsage();

  // First page
  let chartNameValues = await screen.findAllByRole('cell', {
    name: /sample chart/i,
  });

  expect(chartNameValues).toHaveLength(25);
  expect(chartNameValues[0]).toHaveTextContent('Sample chart 1');
  expect(chartNameValues[24]).toHaveTextContent('Sample chart 25');

  // Second page
  userEvent.click(
    screen.getByRole('button', {
      name: /right/i,
    }),
  );

  chartNameValues = await screen.findAllByRole('cell', {
    name: /sample chart/i,
  });

  expect(chartNameValues).toHaveLength(25);
  expect(chartNameValues[0]).toHaveTextContent('Sample chart 26');
  expect(chartNameValues[24]).toHaveTextContent('Sample chart 50');

  // Third page
  userEvent.click(
    screen.getByRole('button', {
      name: /right/i,
    }),
  );

  chartNameValues = await screen.findAllByRole('cell', {
    name: /sample chart/i,
  });

  expect(chartNameValues).toHaveLength(15);
  expect(chartNameValues[0]).toHaveTextContent('Sample chart 51');
  expect(chartNameValues[14]).toHaveTextContent('Sample chart 65');
});
