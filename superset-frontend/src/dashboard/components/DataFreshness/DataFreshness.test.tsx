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
import { ReactNode } from 'react';
import { SupersetClient } from '@superset-ui/core';
import {
  createStore,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import { UiConfigContext } from 'src/components/UiConfigContext';
import { DataFreshnessLabel } from './DataFreshnessLabel';
import { useDataFreshnessLoader } from './hooks';
import type { DashboardFreshness } from './types';
import { formatDataAsOf, getChartDatasetFreshness } from './utils';

const FRESHNESS: DashboardFreshness = {
  data_as_of: '2026-11-25T08:00:00+00:00',
  stale: false,
  datasets: [
    {
      id: 7,
      name: 'invoices',
      data_as_of: '2026-11-26T09:30:00+00:00',
      warn_after_minutes: 120,
      stale: false,
    },
    {
      id: 8,
      name: 'orders',
      data_as_of: '2026-11-25T08:00:00+00:00',
      warn_after_minutes: null,
      stale: false,
    },
  ],
};

const uiConfig = (showDataFreshness: boolean) => ({
  hideTitle: false,
  hideTab: false,
  hideNav: false,
  hideChartControls: false,
  emitDataMasks: false,
  showRowLimitWarning: false,
  showDataFreshness,
});

type StateOptions = {
  enabled?: boolean;
  optIn?: boolean;
  freshness?: DashboardFreshness;
  timezone?: string | null;
};

const dashboardState = (options: StateOptions = {}) => {
  const { enabled = true, optIn = true, timezone = 'UTC' } = options;
  // An explicit `freshness: undefined` means "not loaded".
  const freshness = 'freshness' in options ? options.freshness : FRESHNESS;
  return {
    dashboardInfo: {
      id: 1,
      common: {
        conf: {
          DATA_FRESHNESS_ENABLED: enabled,
          DATA_FRESHNESS_DISPLAY_TIMEZONE: timezone,
        },
      },
      metadata: { show_data_freshness: optIn },
      dataFreshness: freshness,
    },
  };
};

const renderLabel = (
  state: ReturnType<typeof dashboardState>,
  showDataFreshness = true,
) =>
  render(
    <UiConfigContext.Provider value={uiConfig(showDataFreshness)}>
      <DataFreshnessLabel />
    </UiConfigContext.Provider>,
    { useRedux: true, initialState: state },
  );

test('formatDataAsOf uses the configured time zone', () => {
  expect(formatDataAsOf('2026-11-26T09:30:00Z', 'Africa/Nairobi')).toBe(
    'Nov 26, 2026 12:30 PM',
  );
  expect(formatDataAsOf('2026-11-26T09:30:00Z', 'UTC')).toBe(
    'Nov 26, 2026 9:30 AM',
  );
});

test('formatDataAsOf falls back for an unknown time zone', () => {
  expect(() =>
    formatDataAsOf('2026-11-26T09:30:00Z', 'Not/AZone'),
  ).not.toThrow();
});

test('getChartDatasetFreshness finds the dataset behind a chart', () => {
  expect(getChartDatasetFreshness(FRESHNESS, '8__table')?.name).toBe('orders');
  expect(getChartDatasetFreshness(FRESHNESS, '9__table')).toBeUndefined();
  expect(
    getChartDatasetFreshness(FRESHNESS, '8__semantic_view'),
  ).toBeUndefined();
  expect(getChartDatasetFreshness(undefined, '8__table')).toBeUndefined();
});

test('shows the oldest data timestamp with per-dataset detail', async () => {
  renderLabel(dashboardState());

  const label = screen.getByTestId('data-freshness-label');
  expect(label).toHaveTextContent('Data as of Nov 25, 2026 8:00 AM');

  await userEvent.hover(label);
  const tooltip = await screen.findByTestId('data-freshness-tooltip');
  expect(tooltip).toHaveTextContent('invoices: Nov 26, 2026 9:30 AM');
  expect(tooltip).toHaveTextContent('orders: Nov 25, 2026 8:00 AM');
});

test('marks stale datasets', async () => {
  renderLabel(
    dashboardState({
      freshness: {
        ...FRESHNESS,
        stale: true,
        datasets: [{ ...FRESHNESS.datasets[0], stale: true }],
      },
    }),
  );

  const label = screen.getByTestId('data-freshness-label');
  expect(screen.getByRole('img', { name: 'warning' })).toBeInTheDocument();
  await userEvent.hover(label);
  expect(await screen.findByTestId('data-freshness-tooltip')).toHaveTextContent(
    'older than 120 minutes',
  );
});

test.each([
  ['the deployment has it off', dashboardState({ enabled: false }), true],
  ['the dashboard has not opted in', dashboardState({ optIn: false }), true],
  ['an embedding host has not opted in', dashboardState(), false],
  ['there is no answer', dashboardState({ freshness: undefined }), true],
  [
    'no dataset gave a timestamp',
    dashboardState({
      freshness: { data_as_of: null, stale: false, datasets: [] },
    }),
    true,
  ],
])('is hidden when %s', (_, state, showDataFreshness) => {
  renderLabel(state, showDataFreshness);
  expect(screen.queryByTestId('data-freshness-label')).not.toBeInTheDocument();
});

const loadedFreshness = (store: ReturnType<typeof createStore>) =>
  (
    store.getState() as unknown as {
      dashboardInfo: { dataFreshness?: DashboardFreshness };
    }
  ).dashboardInfo.dataFreshness;

const Loader = ({ dashboardId }: { dashboardId?: number }) => {
  useDataFreshnessLoader(dashboardId);
  return null;
};

const renderLoader = (
  state: ReturnType<typeof dashboardState>,
  dashboardId?: number,
  wrapper?: (children: ReactNode) => ReactNode,
) => {
  const store = createStore(state, reducerIndex);
  const element = <Loader dashboardId={dashboardId} />;
  render(
    <UiConfigContext.Provider value={uiConfig(true)}>
      {wrapper ? wrapper(element) : element}
    </UiConfigContext.Provider>,
    { store },
  );
  return store;
};

test('loads the dashboard freshness into the store', async () => {
  const get = jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValue({ json: { result: FRESHNESS } } as any);

  const store = renderLoader(dashboardState({ freshness: undefined }), 1);

  await waitFor(() => expect(loadedFreshness(store)).toEqual(FRESHNESS));
  expect(get).toHaveBeenCalledWith({
    endpoint: '/api/v1/dashboard/1/freshness',
  });
  get.mockRestore();
});

test('does not load freshness when it is not shown', () => {
  const get = jest.spyOn(SupersetClient, 'get');

  renderLoader(dashboardState({ optIn: false }), 1);
  renderLoader(dashboardState(), undefined);

  expect(get).not.toHaveBeenCalled();
  get.mockRestore();
});

test('clears freshness when loading fails', async () => {
  const get = jest
    .spyOn(SupersetClient, 'get')
    .mockRejectedValue(new Error('nope'));

  const store = renderLoader(dashboardState(), 1);

  await waitFor(() => expect(loadedFreshness(store)).toBeUndefined());
  get.mockRestore();
});
