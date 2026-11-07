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
import { act, screen, userEvent, waitFor } from 'spec/helpers/testing-library';
import {
  setControlValue,
  setSaveAction,
} from 'src/explore/actions/exploreActions';

import {
  chartDataCalls,
  chartRangesAnswer,
  checkCalls,
  checked,
  clearServer,
  controlOf,
  controls,
  EXPLORE_GET,
  findUpdateChart,
  focusIn,
  LAST_45_DAYS,
  LAST_WEEK,
  mockRoutes,
  pressEnter,
  RANGE_REJECTED,
  registerCharts,
  registerSectionsChart,
  rejectSecondRun,
  RENDERED,
  renderExplore,
  resetServer,
  restoreUnsavedPrompt,
  sectionsState,
  server,
  settle,
  SPAN_30,
  state,
  updateChart,
  withoutUnsavedPrompt,
} from './ExploreViewContainer.timeRangeLimits.testHelpers';

/*
 * Time range limits in Explore: focus moves after a blocked run or a
 * server rejection.
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

test('Ctrl+Enter while invalid sends no request and moves focus to the first marked control (Filters)', async () => {
  withoutUnsavedPrompt();
  server.answer = LAST_45_DAYS;
  const { store } = renderExplore(sectionsState());
  await checked();
  expect(store.getState().explore.timeRangeCheck?.status).toBe('invalid');

  pressEnter({ ctrlKey: true });

  await waitFor(() => focusIn('adhoc_filters'));
  expect(chartDataCalls()).toBe(0);
  expect(store.getState().explore.timeRangeFocusRequest).toBeNull();
});

test('Ctrl+Enter while the check is pending moves no focus', async () => {
  withoutUnsavedPrompt();
  let release!: () => void;
  const held = new Promise<void>(done => {
    release = done;
  });
  fetchMock.removeRoutes();
  mockRoutes(undefined, () => held.then(() => chartRangesAnswer(LAST_45_DAYS)));
  const { store } = renderExplore(sectionsState());
  await waitFor(() => expect(checkCalls()).toHaveLength(1));
  expect(store.getState().explore.timeRangeCheck?.status).toBe('pending');
  const requests: unknown[] = [];
  store.subscribe(() =>
    requests.push(store.getState().explore.timeRangeFocusRequest),
  );

  pressEnter({ ctrlKey: true });
  release();
  await waitFor(() =>
    expect(store.getState().explore.timeRangeCheck?.status).toBe('invalid'),
  );
  await settle();

  expect(requests.filter(Boolean)).toHaveLength(0);
  expect(controlOf('adhoc_filters')?.contains(document.activeElement)).toBe(
    false,
  );
});

test('on the Customize tab, Ctrl+Enter switches to the Data tab first', async () => {
  withoutUnsavedPrompt();
  server.answer = LAST_45_DAYS;
  renderExplore(sectionsState());
  await checked();
  await userEvent.click(screen.getByRole('tab', { name: 'Customize' }));
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: 'Customize' })).toHaveAttribute(
      'aria-selected',
      'true',
    ),
  );

  pressEnter({ ctrlKey: true });

  await waitFor(() => focusIn('adhoc_filters'));
  expect(screen.getByRole('tab', { name: /^Data/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('a marked control opens its closed section and receives focus', async () => {
  withoutUnsavedPrompt();
  server.answer = [
    {
      ...LAST_WEEK[0],
      source: [{ kind: 'adhoc_filter', query_index: 0, index: 0 }],
    },
    {
      ...LAST_45_DAYS[0],
      source: [{ kind: 'time_comparison', query_index: 0, index: null }],
    },
  ];
  const { store } = renderExplore(sectionsState());
  await checked();
  expect(
    Object.keys(store.getState().explore.timeRangeCheck?.controlErrors ?? {}),
  ).toEqual(['time_compare']);
  const header = screen.getByRole('button', { name: /Advanced analytics/ });
  expect(header).toHaveAttribute('aria-expanded', 'false');
  expect(controlOf('time_compare')).toBeNull();

  pressEnter({ ctrlKey: true });

  await waitFor(() => focusIn('time_compare'));
  expect(header).toHaveAttribute('aria-expanded', 'true');
});

test('a marked control with a field gets focus on the field, not on its header label', async () => {
  withoutUnsavedPrompt();
  server.answer = [
    {
      ...LAST_WEEK[0],
      source: [{ kind: 'adhoc_filter', query_index: 0, index: 0 }],
    },
    {
      ...LAST_45_DAYS[0],
      source: [{ kind: 'time_comparison', query_index: 0, index: null }],
    },
  ];
  renderExplore(sectionsState());
  await checked();

  pressEnter({ ctrlKey: true });

  await waitFor(() =>
    expect(document.activeElement).toBe(
      controlOf('time_compare')?.querySelector('input'),
    ),
  );
  expect(
    controlOf('time_compare')
      ?.querySelector('.ControlHeader')
      ?.contains(document.activeElement),
  ).toBe(false);
});

test('the Filters control: focus goes to its first filter, the field after its header label', async () => {
  withoutUnsavedPrompt();
  server.answer = LAST_45_DAYS;
  const initial = sectionsState();
  const base = controls();
  initial.explore.controls = {
    ...initial.explore.controls,
    adhoc_filters: {
      ...base.adhoc_filters,
      type: 'DndFilterSelect',
      columns: initial.explore.datasource.columns,
      savedMetrics: [],
      datasource: initial.explore.datasource,
    },
  } as never;
  fetchMock.get('glob:*/api/v1/time_range/*', {
    result: [{ since: '2026-10-24', until: '2026-10-31' }],
  });
  renderExplore(initial);
  await checked();
  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls('glob:*/api/v1/time_range/*').length,
    ).toBeGreaterThan(0),
  );
  const control = controlOf('adhoc_filters');
  expect(control?.querySelector('[data-test="option-label"]')).not.toBeNull();
  const pill = control?.querySelector<HTMLElement>(
    '[aria-roledescription="sortable"]',
  );
  expect(pill).toContainElement(
    control?.querySelector<HTMLElement>('[data-test="option-label"]') ?? null,
  );

  pressEnter({ ctrlKey: true });

  await waitFor(() => expect(document.activeElement).toBe(pill));
});

test('a time range 400 after Update chart moves focus to the marked control once the limits are read again', async () => {
  withoutUnsavedPrompt();
  rejectSecondRun();
  renderExplore(sectionsState());
  await checked();
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  server.answer = LAST_45_DAYS;

  await userEvent.click(await findUpdateChart());

  await waitFor(() => expect(chartDataCalls()).toBe(2));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(EXPLORE_GET)).toHaveLength(1),
  );
  await waitFor(() => focusIn('adhoc_filters'));
  expect(screen.getByText('Time range not allowed')).toBeInTheDocument();
});

test('a time range 400 for the page-open run moves no focus, also when the re-check marks the control', async () => {
  withoutUnsavedPrompt();
  fetchMock.removeRoutes();
  mockRoutes(() => {
    server.answer = LAST_45_DAYS;
    return RANGE_REJECTED;
  });
  fetchMock.get(EXPLORE_GET, {
    result: { time_range_limits: { global: SPAN_30, dataset: null } },
  });
  const { store } = renderExplore(sectionsState());
  const requests: unknown[] = [];
  store.subscribe(() =>
    requests.push(store.getState().explore.timeRangeFocusRequest),
  );
  await checked();
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(EXPLORE_GET)).toHaveLength(1),
  );
  await checked(2);
  await waitFor(() =>
    expect(store.getState().explore.timeRangeCheck?.status).toBe('invalid'),
  );
  expect(
    Object.keys(store.getState().explore.timeRangeCheck?.controlErrors ?? {}),
  ).toEqual(['adhoc_filters']);
  await settle();
  await settle();

  expect(requests.filter(Boolean)).toHaveLength(0);
  expect(controlOf('adhoc_filters')?.contains(document.activeElement)).toBe(
    false,
  );
});

test('the save effect while the check refuses the run moves no focus', async () => {
  withoutUnsavedPrompt();
  server.answer = LAST_45_DAYS;
  const { store } = renderExplore(sectionsState());
  await checked();
  expect(store.getState().explore.timeRangeCheck?.status).toBe('invalid');
  const requests: unknown[] = [];
  store.subscribe(() =>
    requests.push(store.getState().explore.timeRangeFocusRequest),
  );

  act(() => {
    store.dispatch(setSaveAction('overwrite'));
  });
  await settle();
  await settle();

  expect(chartDataCalls()).toBe(0);
  expect(requests.filter(Boolean)).toHaveLength(0);
  expect(controlOf('adhoc_filters')?.contains(document.activeElement)).toBe(
    false,
  );
});

test('typing in a field before the re-check answers keeps focus there', async () => {
  withoutUnsavedPrompt();
  rejectSecondRun();
  const field = document.createElement('input');
  document.body.appendChild(field);
  try {
    renderExplore(sectionsState());
    await checked();
    await waitFor(() => expect(chartDataCalls()).toBe(1));
    server.answer = LAST_45_DAYS;

    await userEvent.click(await findUpdateChart());
    await waitFor(() => expect(chartDataCalls()).toBe(2));
    field.focus();
    await waitFor(() =>
      expect(fetchMock.callHistory.calls(EXPLORE_GET)).toHaveLength(1),
    );
    await checked(2);
    await settle();
    await settle();

    expect(field).toHaveFocus();
  } finally {
    field.remove();
  }
});

test('a control edit before the re-check answers cancels the move', async () => {
  withoutUnsavedPrompt();
  rejectSecondRun();
  const { store } = renderExplore(sectionsState());
  await checked();
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  server.answer = LAST_45_DAYS;

  await userEvent.click(await findUpdateChart());
  await waitFor(() => expect(chartDataCalls()).toBe(2));
  act(() => {
    store.dispatch(
      setControlValue('adhoc_filters', [
        { ...controls().adhoc_filters.value[0], comparator: 'Last 45 days' },
      ]),
    );
  });
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(EXPLORE_GET)).toHaveLength(1),
  );
  await checked(2);
  await settle();
  await settle();

  expect(store.getState().explore.timeRangeCheck?.status).toBe('invalid');
  expect(controlOf('adhoc_filters')?.contains(document.activeElement)).toBe(
    false,
  );
});

test('check Retry keeps focus: the alert stays with a loading Retry, and focus stays on Retry after another failure', async () => {
  withoutUnsavedPrompt();
  fetchMock.removeRoutes();
  mockRoutes(undefined, 500);
  renderExplore(state());
  const retry = await screen.findByRole(
    'button',
    { name: 'Retry' },
    { timeout: 20000 },
  );
  expect(updateChart()).toHaveAttribute(
    'aria-describedby',
    'explore-time-range-failed-text',
  );
  expect(
    document.getElementById('explore-time-range-failed-text'),
  ).toHaveTextContent(
    'Time range limits could not be loaded. Queries are paused to protect the database.',
  );
  retry.focus();
  const calls = checkCalls().length;

  await userEvent.click(retry);

  await waitFor(() => expect(retry).toHaveClass('ant-btn-loading'));
  expect(retry).toHaveFocus();
  await checked(calls + 1);
  await waitFor(() => expect(retry).not.toHaveClass('ant-btn-loading'));
  expect(retry).toBeInTheDocument();
  expect(retry).toHaveFocus();
});

test('after a check Retry that works, focus goes to Update chart', async () => {
  withoutUnsavedPrompt();
  fetchMock.removeRoutes();
  mockRoutes(undefined, 500);
  renderExplore(state());
  const retry = await screen.findByRole(
    'button',
    { name: 'Retry' },
    { timeout: 20000 },
  );
  retry.focus();
  fetchMock.removeRoutes();
  mockRoutes();

  await userEvent.click(retry);

  await waitFor(() => expect(chartDataCalls()).toBe(1));
  await waitFor(() => expect(updateChart()).toHaveFocus());
  expect(document.activeElement).not.toBe(document.body);
});

test('after a policy Retry that works, focus goes to Update chart', async () => {
  withoutUnsavedPrompt();
  fetchMock.get(EXPLORE_GET, {
    result: { time_range_limits: { global: SPAN_30, dataset: null } },
  });
  renderExplore(state({ limits: { status: 'failed' } }));
  const retry = await screen.findByRole('button', { name: 'Retry' });
  retry.focus();

  await userEvent.click(retry);

  await waitFor(() =>
    expect(fetchMock.callHistory.calls(EXPLORE_GET)).toHaveLength(1),
  );
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  await waitFor(() => expect(updateChart()).toHaveFocus());
});

test('a time range 400 after "click here" in the stale-chart notice moves focus to the marked control', async () => {
  withoutUnsavedPrompt();
  rejectSecondRun();
  const { store } = renderExplore(sectionsState());
  await checked();
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  act(() => {
    store.dispatch(setControlValue('time_compare', 'x'));
  });
  await checked(2);
  server.answer = LAST_45_DAYS;

  await userEvent.click(await screen.findByText('click here'));

  await waitFor(() => expect(chartDataCalls()).toBe(2));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(EXPLORE_GET)).toHaveLength(1),
  );
  await waitFor(() => focusIn('adhoc_filters'));
  expect(screen.getByText('Time range not allowed')).toBeInTheDocument();
});

test('a time range 400 after the Cached pill moves focus to the marked control', async () => {
  withoutUnsavedPrompt();
  fetchMock.removeRoutes();
  mockRoutes(RANGE_REJECTED);
  fetchMock.get(EXPLORE_GET, {
    result: { time_range_limits: { global: SPAN_30, dataset: null } },
  });
  server.answer = LAST_45_DAYS;
  const { store } = renderExplore(sectionsState({ queriesResponse: RENDERED }));
  await checked();
  expect(chartDataCalls()).toBe(0);
  server.answer = LAST_WEEK;
  act(() => {
    store.dispatch(
      setControlValue('adhoc_filters', [
        { ...controls().adhoc_filters.value[0], comparator: 'Last day' },
      ]),
    );
  });
  await checked(2);
  expect(store.getState().explore.timeRangeCheck?.status).toBe('valid');
  server.answer = LAST_45_DAYS;

  await userEvent.click(await screen.findByText('Cached'));

  await waitFor(() => expect(chartDataCalls()).toBe(1));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(EXPLORE_GET)).toHaveLength(1),
  );
  await waitFor(() => focusIn('adhoc_filters'));
});
