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
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import type { dashboards } from '@apache-superset/core';
import DashboardContainer from 'src/dashboard/containers/Dashboard';
import DefaultDashboardRenderer from './DefaultDashboardRenderer';

jest.mock('src/dashboard/containers/Dashboard', () => ({
  __esModule: true,
  default: jest.fn(({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  )),
}));

jest.mock('src/dashboard/components/DashboardBuilder/DashboardBuilder', () => ({
  __esModule: true,
  default: () => <div data-test="dashboard-builder">DashboardBuilder</div>,
}));

jest.mock('src/dashboard/util/activeDashboardFilters', () => ({
  getActiveFilters: () => ({
    'legacy-filter': { scope: [99], values: {} },
  }),
}));

const MockDashboardContainer = DashboardContainer as unknown as jest.Mock;

const rendererProps: dashboards.DashboardRendererProps = {
  dashboard: { id: 1, title: 'Ignored', metadata: {}, layout: {} },
  charts: [],
  datasets: [],
  initialDataMask: {},
};

const initialState = {
  dashboardInfo: { id: 1, metadata: { chart_configuration: {} } },
  dashboardState: { sliceIds: [7, 123] },
  nativeFilters: {
    filters: {
      'NATIVE_FILTER-x': {
        id: 'NATIVE_FILTER-x',
        chartsInScope: [7],
        filterType: 'filter_select',
        targets: [{ column: { name: 'country' }, datasetId: 3 }],
      },
    },
  },
  dataMask: {
    'NATIVE_FILTER-x': {
      id: 'NATIVE_FILTER-x',
      extraFormData: {
        filters: [{ col: 'country', op: 'IN', val: ['USA'] }],
      },
      filterState: { value: ['USA'] },
    },
    '123': {
      id: '123',
      extraFormData: {},
      filterState: {},
      ownState: { currentPage: 2, clientView: { rows: [1, 2, 3] } },
    },
  },
};

beforeEach(() => {
  MockDashboardContainer.mockClear();
});

const setup = () =>
  render(
    <Suspense fallback="loading">
      <DefaultDashboardRenderer {...rendererProps} />
    </Suspense>,
    { useRedux: true, initialState },
  );

test('renders DashboardBuilder inside DashboardContainer', async () => {
  setup();

  expect(await screen.findByTestId('dashboard-builder')).toBeInTheDocument();
});

test('derives activeFilters from Redux, merging legacy and native filters', async () => {
  setup();
  await screen.findByTestId('dashboard-builder');

  const [[{ activeFilters }]] = MockDashboardContainer.mock.calls;
  // Legacy filter_box filters from the module singleton are merged in
  expect(activeFilters['legacy-filter']).toEqual({ scope: [99], values: {} });
  // Native filter resolved with its chartsInScope and extraFormData values
  expect(activeFilters['NATIVE_FILTER-x']).toEqual(
    expect.objectContaining({
      scope: [7],
      values: {
        filters: [{ col: 'country', op: 'IN', val: ['USA'] }],
      },
      filterType: 'filter_select',
    }),
  );
});

test('derives ownDataCharts from dataMask ownState, stripping clientView', async () => {
  setup();
  await screen.findByTestId('dashboard-builder');

  const [[{ ownDataCharts }]] = MockDashboardContainer.mock.calls;
  // Only entries with ownState are relevant, and the TableChart clientView
  // payload must be stripped so it never triggers chart re-queries
  expect(ownDataCharts).toEqual({ '123': { currentPage: 2 } });
});
