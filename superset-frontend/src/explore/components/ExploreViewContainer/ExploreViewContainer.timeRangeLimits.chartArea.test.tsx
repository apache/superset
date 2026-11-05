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
import { VizType } from '@superset-ui/core';
import { act, screen, userEvent, waitFor } from 'spec/helpers/testing-library';
import { setControlValue } from 'src/explore/actions/exploreActions';
import type { ExploreTimeRangeLimits } from 'src/explore/actions/timeRangeLimitsActions';

import {
  chartDataCalls,
  checkCalls,
  checked,
  clearServer,
  controls,
  DASHBOARD,
  EXPLORE_GET,
  findUpdateChart,
  LAST_45_DAYS,
  LAST_WEEK,
  LOADED,
  mockIsFeatureEnabled,
  mockRoutes,
  MODERN,
  OPEN_RANGE,
  OPEN_TEXT,
  REASON_ID,
  registerCharts,
  registerSectionsChart,
  RANGE_REJECTED,
  RENDERED,
  renderExplore,
  resetServer,
  restoreUnsavedPrompt,
  server,
  settle,
  SPAN_30,
  SPAN_TEXT,
  state,
  updateChart,
  withoutUnsavedPrompt,
} from './ExploreViewContainer.timeRangeLimits.testHelpers';

/*
 * Time range limits in Explore: the chart area (loading, failures and
 * Retry, the reason text) and the Samples request.
 */

jest.mock(
  'src/explore/components/controls/LayerConfigsControl/LayerConfigsControl',
  () => () => null,
);

jest.mock('@superset-ui/core', () => ({
  __esModule: true,
  ...jest.requireActual('@superset-ui/core'),
  isMatrixifyEnabled: jest.fn(() => false),
  isFeatureEnabled: jest.fn(),
}));

jest.mock(
  'src/explore/components/ExploreChartPanel/useResizeDetectorByObserver',
  () => ({
    __esModule: true,
    default: () => ({ height: 100, width: 100 }),
  }),
);

beforeAll(() => {
  registerCharts();
  registerSectionsChart();
});

beforeEach(() => {
  resetServer();
});

afterEach(() => {
  clearServer();
  restoreUnsavedPrompt();
});

test('re-check: the last chart stays, no Loading, aria-busy and Update chart disabled', async () => {
  const { store, container } = renderExplore(
    state({ queriesResponse: RENDERED }),
  );
  await checked();
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  act(() => {
    store.dispatch(
      setControlValue('adhoc_filters', [
        { ...controls().adhoc_filters.value[0], comparator: 'Last day' },
      ]),
    );
  });
  expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  expect(screen.getByTestId('slice-container')).toBeInTheDocument();
  expect(updateChart()).toBeDisabled();
  await checked(2);
  expect(container.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
});

test('page open: Loading with aria-busy while nothing is rendered yet', async () => {
  const { container } = renderExplore();
  expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  await checked();
});

test('check failed: limits-failed Alert, Retry sends one check per click, blocked until a check succeeds', async () => {
  fetchMock.removeRoutes();
  mockRoutes(undefined, 500);
  renderExplore();
  await screen.findByText('Retry', undefined, { timeout: 5000 });
  const retry = screen.getByRole('button', { name: 'Retry' });
  expect(
    screen.getByText(
      'Time range limits could not be loaded. Queries are paused to protect the database.',
    ),
  ).toBeInTheDocument();
  expect(screen.queryByTestId('slice-container')).not.toBeInTheDocument();
  expect(await findUpdateChart()).toBeDisabled();
  const calls = checkCalls().length;
  await userEvent.click(retry);
  await checked(calls + 1);
  expect(checkCalls()).toHaveLength(calls + 1);
  expect(chartDataCalls()).toBe(0);

  fetchMock.removeRoutes();
  mockRoutes();
  await screen.findByText('Retry', undefined, { timeout: 5000 });
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  expect(
    screen.queryByRole('button', { name: 'Retry' }),
  ).not.toBeInTheDocument();
});

test('check failed after a chart rendered: the limits-failed Alert shows and the chart stays', async () => {
  const { store } = renderExplore(state({ queriesResponse: RENDERED }));
  await checked();
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  fetchMock.removeRoutes();
  mockRoutes(undefined, 500);
  act(() => {
    store.dispatch(
      setControlValue('adhoc_filters', [
        { ...controls().adhoc_filters.value[0], comparator: 'Last day' },
      ]),
    );
  });
  expect(
    await screen.findByRole('button', { name: 'Retry' }, { timeout: 10000 }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'Time range limits could not be loaded. Queries are paused to protect the database.',
    ),
  ).toBeInTheDocument();
  expect(screen.getByTestId('slice-container')).toBeInTheDocument();
  expect(updateChart()).toBeDisabled();
  expect(chartDataCalls()).toBe(1);
});

test('policy failed: limits-failed Alert, Retry reads the current dataset once per click', async () => {
  fetchMock.get(EXPLORE_GET, 503);
  const initial = state({ limits: { status: 'failed' } });
  initial.explore.datasource = { ...initial.explore.datasource, id: 5 };
  renderExplore(initial);
  expect(
    await screen.findByText(
      'Time range limits could not be loaded. Queries are paused to protect the database.',
    ),
  ).toBeInTheDocument();
  expect(await findUpdateChart()).toBeDisabled();
  await settle();
  expect(checkCalls()).toHaveLength(0);
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(EXPLORE_GET)).toHaveLength(1),
  );
  expect(fetchMock.callHistory.calls(EXPLORE_GET)[0].url).toContain(
    'datasource_id=5&datasource_type=table',
  );
  await settle();
  expect(fetchMock.callHistory.calls(EXPLORE_GET)).toHaveLength(1);
  expect(chartDataCalls()).toBe(0);
});

test('standalone: an invalid range sends no request and shows the chart-area state', async () => {
  server.answer = LAST_45_DAYS;
  renderExplore(state({ explore: { standalone: true } }));
  await checked();
  expect(chartDataCalls()).toBe(0);
  expect(
    await screen.findByText('Add required control values to preview chart'),
  ).toBeInTheDocument();
});

test('a server 400 reads the limits once, keeps the range and runs nothing again', async () => {
  fetchMock.removeRoutes();
  mockRoutes({
    status: 400,
    body: {
      errors: [
        {
          error_type: 'TIME_RANGE_LIMIT_ERROR',
          message: 'Range is too long.',
          level: 'error',
          extra: { reason_code: 'MAX_SPAN_EXCEEDED' },
        },
      ],
    },
  });
  fetchMock.get(EXPLORE_GET, {
    result: { time_range_limits: { global: SPAN_30, dataset: null } },
  });
  const { store } = renderExplore();
  await checked();
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(EXPLORE_GET)).toHaveLength(1),
  );
  await checked(2);
  await settle();
  expect(fetchMock.callHistory.calls(EXPLORE_GET)).toHaveLength(1);
  expect(chartDataCalls()).toBe(1);
  expect(store.getState().explore.controls.adhoc_filters.value).toEqual(
    controls().adhoc_filters.value,
  );
});

const SPAN_60 = {
  max_span: { quantity: 60, time_grain: 'P1D' },
  max_look_back: null,
  max_look_forward: null,
};

async function renderRefused() {
  const limits = { policy: SPAN_30 };
  const server400 = { on: true };
  fetchMock.removeRoutes();
  mockRoutes(() =>
    server400.on
      ? RANGE_REJECTED
      : { result: [{ data: [], colnames: [], coltypes: [], rowcount: 0 }] },
  );
  fetchMock.get(EXPLORE_GET, () => ({
    result: { time_range_limits: { global: limits.policy, dataset: null } },
  }));
  server.answer = LAST_45_DAYS;
  const { store } = renderExplore(
    state({
      limits: {
        ...LOADED,
        levels: [
          { source: 'global', policy: SPAN_60 },
          { source: 'dataset', policy: null },
        ],
      } as ExploreTimeRangeLimits,
    }),
  );
  await checked();
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  expect(await screen.findByText(SPAN_TEXT)).toBeInTheDocument();
  expect(await findUpdateChart()).toBeDisabled();
  return {
    store,
    restore: () => {
      limits.policy = SPAN_60;
      server400.on = false;
    },
  };
}

test('a refusal the check did not predict offers Retry, which reads the limits again and runs once the range passes', async () => {
  const { restore } = await renderRefused();
  restore();
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(chartDataCalls()).toBe(2));
  await waitFor(() =>
    expect(screen.queryByText(SPAN_TEXT)).not.toBeInTheDocument(),
  );
  expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
});

test('that Retry reads the limits once per click and moves focus to Update chart after the run', async () => {
  withoutUnsavedPrompt();
  const { restore } = await renderRefused();
  expect(fetchMock.callHistory.calls(EXPLORE_GET)).toHaveLength(1);
  restore();
  await userEvent.dblClick(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(chartDataCalls()).toBe(2));
  await waitFor(() => expect(updateChart()).toHaveFocus());
  expect(fetchMock.callHistory.calls(EXPLORE_GET)).toHaveLength(2);
});

test('no Retry once the user picks a range the check refuses itself', async () => {
  const { store } = await renderRefused();
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  act(() => {
    store.dispatch(
      setControlValue('adhoc_filters', [
        { ...controls().adhoc_filters.value[0], comparator: 'Last 40 days' },
      ]),
    );
  });
  await checked(2);
  expect(await screen.findByText(SPAN_TEXT)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
});

test.each([
  ['a modern chart (Filters)', MODERN, {}, OPEN_RANGE, ['adhoc_filters']],
  [
    'Mixed Timeseries (both Filters)',
    MODERN,
    { adhoc_filters_b: { value: [], label: 'Filters' } },
    OPEN_RANGE,
    ['adhoc_filters', 'adhoc_filters_b'],
  ],
  [
    'a modern chart with a named source that maps to no control',
    MODERN,
    {},
    [
      {
        ...LAST_45_DAYS[0],
        source: [{ kind: 'time_comparison', query_index: 0, index: 0 }],
      },
    ],
    ['adhoc_filters'],
  ],
])(
  'an unnamed or unmapped source on %s: the error on the first time control, "Add required control values" in the chart area',
  async (_name, vizType, extraControls, ranges, expected) => {
    server.answer = ranges;
    const initial = state();
    initial.explore.controls = {
      ...controls('No filter'),
      viz_type: { value: vizType as VizType },
      ...extraControls,
    } as never;
    const { store } = renderExplore(initial);
    await checked();
    const { controls: stored } = store.getState().explore;
    const message =
      ranges === OPEN_RANGE
        ? OPEN_TEXT
        : "Range can't be longer than 30 days. This one is 45 days.";
    expected.forEach(name =>
      expect(stored[name].validationErrors).toEqual([message]),
    );
    expect(store.getState().explore.timeRangeCheck?.buttonErrors).toEqual([]);
    expect(
      await screen.findByText('Add required control values to preview chart'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('No results were returned for this query'),
    ).not.toBeInTheDocument();
    expect(await findUpdateChart()).toBeDisabled();
    expect(chartDataCalls()).toBe(0);
  },
);

// Guard test: passes on the base too.
test('an unnamed source on a chart with neither time_range nor Filters: the Update chart fallback', async () => {
  server.answer = OPEN_RANGE;
  const initial = state();
  const { adhoc_filters: _filters, ...rest } = controls();
  initial.explore.controls = rest as never;
  const { store } = renderExplore(initial);
  await checked();
  expect(store.getState().explore.timeRangeCheck).toMatchObject({
    status: 'unbounded',
    controlErrors: {},
    buttonErrors: [OPEN_TEXT],
  });
  expect(await findUpdateChart()).toBeDisabled();
  expect(chartDataCalls()).toBe(0);
});

test('the reason is text in the chart area with its own title, and Update chart and Save point at it', async () => {
  withoutUnsavedPrompt();
  server.answer = LAST_45_DAYS;
  renderExplore(state());
  await checked();

  const reason = await screen.findByText(SPAN_TEXT);
  expect(reason).toHaveAttribute('id', REASON_ID);
  expect(reason.closest('[role="alert"]')).toHaveTextContent(
    'Time range not allowed',
  );
  expect(updateChart()).toBeDisabled();
  expect(updateChart()).toHaveAttribute('aria-describedby', REASON_ID);
  expect(screen.getByTestId('query-save-button')).toHaveAttribute(
    'aria-describedby',
    REASON_ID,
  );
  expect(
    screen.queryByText('Required control values have been removed'),
  ).not.toBeInTheDocument();
});

test('with a rendered chart the reason replaces the stale-chart notice, one alert', async () => {
  withoutUnsavedPrompt();
  const { store } = renderExplore(state({ queriesResponse: RENDERED }));
  await checked();
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  server.answer = LAST_45_DAYS;
  act(() => {
    store.dispatch(
      setControlValue('adhoc_filters', [
        { ...controls().adhoc_filters.value[0], comparator: 'Last 45 days' },
      ]),
    );
  });
  await checked(2);

  expect(await screen.findByText(SPAN_TEXT)).toHaveAttribute('id', REASON_ID);
  expect(screen.getAllByText('Time range not allowed')).toHaveLength(1);
  expect(
    screen.queryByText('Required control values have been removed'),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText('Your chart is not up to date'),
  ).not.toBeInTheDocument();
  expect(screen.getByTestId('slice-container')).toBeInTheDocument();
});

test('the reason stays while the next check is pending and is replaced only when the answer differs', async () => {
  withoutUnsavedPrompt();
  server.answer = LAST_45_DAYS;
  const { store } = renderExplore(state());
  await checked();
  const reason = await screen.findByText(SPAN_TEXT);

  act(() => {
    store.dispatch(
      setControlValue('adhoc_filters', [
        { ...controls().adhoc_filters.value[0], comparator: 'Last 45 days' },
      ]),
    );
  });
  expect(store.getState().explore.timeRangeCheck?.status).toBe('pending');
  expect(screen.getByText(SPAN_TEXT)).toBe(reason);
  await checked(2);
  expect(screen.getByText(SPAN_TEXT)).toBe(reason);

  server.answer = LAST_WEEK;
  act(() => {
    store.dispatch(
      setControlValue('adhoc_filters', [
        { ...controls().adhoc_filters.value[0], comparator: 'Last week' },
      ]),
    );
  });
  await checked(3);
  await waitFor(() =>
    expect(screen.queryByText(SPAN_TEXT)).not.toBeInTheDocument(),
  );
  expect(updateChart()).not.toHaveAttribute('aria-describedby');
});

test('flag off: no reason in the chart area and no aria-describedby', async () => {
  withoutUnsavedPrompt();
  mockIsFeatureEnabled.mockReturnValue(false);
  server.answer = LAST_45_DAYS;
  renderExplore(state({ limits: null }));
  await settle();

  expect(screen.queryByText('Time range not allowed')).not.toBeInTheDocument();
  expect(await findUpdateChart()).not.toHaveAttribute('aria-describedby');
  expect(screen.getByTestId('query-save-button')).not.toHaveAttribute(
    'aria-describedby',
  );
});

test('no reason in the chart area and no aria-describedby while the chart is loading', async () => {
  withoutUnsavedPrompt();
  server.answer = LAST_45_DAYS;
  const { store } = renderExplore(state({ queriesResponse: RENDERED }));
  await checked();
  expect(await screen.findByText(SPAN_TEXT)).toBeInTheDocument();

  act(() => {
    store.dispatch({
      type: 'CHART_UPDATE_STARTED',
      key: 1,
      queryController: null,
      latestQueryFormData: {},
    });
  });

  expect(store.getState().charts[1].chartStatus).toBe('loading');
  expect(screen.queryByText(SPAN_TEXT)).not.toBeInTheDocument();
  expect(screen.queryByText('Time range not allowed')).not.toBeInTheDocument();
  expect(screen.getByTestId('query-save-button')).not.toHaveAttribute(
    'aria-describedby',
  );
});

const SAMPLES = 'glob:*/datasource/samples*';

const openSamples = async () => {
  fetchMock.post(
    SAMPLES,
    { result: { data: [], colnames: [], coltypes: [] } },
    { name: 'samples' },
  );
  await userEvent.click(await screen.findByRole('tab', { name: 'Samples' }));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls('samples')).toHaveLength(1),
  );
  return fetchMock.callHistory.calls('samples')[0].url;
};

test('from a dashboard, the Samples request names it with the limits on', async () => {
  server.dashboardId = 7;
  fetchMock.get(DASHBOARD, {
    result: { dashboard: null, global: null, datasets: [] },
  });
  renderExplore(state({ formData: { dashboardId: 7 } }));
  await checked();
  expect(await openSamples()).toContain('dashboard_id=7');
});

test('flag off, the Samples request names no dashboard', async () => {
  mockIsFeatureEnabled.mockReturnValue(false);
  renderExplore(state({ limits: null, formData: { dashboardId: 7 } }));
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  expect(await openSamples()).not.toContain('dashboard_id');
});
