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
import type { Store } from 'redux';
import { act, waitFor } from 'spec/helpers/testing-library';
import type { ExploreState } from 'src/explore/reducers/exploreReducer';

import {
  chartRangesAnswer,
  checkCalls,
  checked,
  clearServer,
  controls,
  DASHBOARD,
  LAST_45_DAYS,
  LAST_WEEK,
  lastCheckBody,
  mockRoutes,
  NOW,
  registerCharts,
  renderExplore,
  resetServer,
  server,
  settle,
  state,
} from './ExploreViewContainer.timeRangeLimits.testHelpers';

/*
 * Time range limits in Explore: the fixed choices of the time comparison
 * controls are checked in the same chart ranges call, and the ones that break
 * a limit get a reason.
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
});

beforeEach(() => {
  resetServer();
});

afterEach(() => {
  clearServer();
});

const FAR_BACK = {
  since: '2025-04-01T00:00:00',
  until: '2025-05-31T00:00:00',
};

type ChartsBody = {
  charts: {
    key: string;
    query_context: { form_data: Record<string, unknown> };
  }[];
};

const optionControls = (extra: Record<string, unknown> = {}) => ({
  ...controls(),
  time_compare: {
    value: [],
    type: 'SelectControl',
    multi: true,
    label: 'Time shift',
    choices: [
      ['1 year ago', '1 year ago'],
      ['2 years ago', '2 years ago'],
      ['custom', 'Custom'],
      ['inherit', 'Inherit range from time filter'],
    ],
  },
  ...extra,
});

const optionState = (
  extra: Record<string, unknown> = {},
  filter = 'Last week',
  options: Parameters<typeof state>[0] = {},
) =>
  state({
    ...options,
    explore: {
      controls: {
        ...optionControls(extra),
        adhoc_filters: controls(filter).adhoc_filters,
      },
      ...options.explore,
    },
  });

const optionAnswers =
  (
    failing: (entry: ChartsBody['charts'][number]) => boolean,
    errored: (key: string) => boolean = () => false,
  ) =>
  ({ options }: { options: { body?: unknown } }) => {
    const { charts } = JSON.parse(String(options.body)) as ChartsBody;
    return {
      result: {
        ...NOW,
        charts: charts.map(entry => {
          if (errored(entry.key)) {
            return {
              key: entry.key,
              status: 'error',
              error: { status: 400, body: {} },
            };
          }
          const [, , offset] = entry.key.split(':');
          const ranges = entry.key.startsWith('opt:')
            ? [
                {
                  ...(failing(entry) ? FAR_BACK : LAST_WEEK[0]),
                  time_offset: offset,
                  source: [
                    { kind: 'time_comparison', query_index: 0, index: 0 },
                  ],
                },
              ]
            : server.answer.map(item => ({
                time_offset: null,
                source: [{ kind: 'adhoc_filter', query_index: 0, index: 0 }],
                ...item,
              }));
          return {
            key: entry.key,
            status: 'ok',
            ranges,
            dataset_id: server.datasetId,
            dashboard_id: server.dashboardId,
          };
        }),
      },
    };
  };

const SEEDED = {
  key: 'old',
  status: 'invalid',
  failures: [],
  controlErrors: {},
  buttonErrors: [],
  optionReasons: { time_compare: { '2 years ago': 'too early' } },
};

const reasonsOf = (store: Store<{ explore: ExploreState }>) =>
  store.getState().explore.timeRangeCheck?.optionReasons;

const answerWith = (answers: ReturnType<typeof optionAnswers>) => {
  fetchMock.removeRoutes();
  mockRoutes(undefined, answers);
};

test('one call carries the main entry first and one entry per fixed choice, never custom; a far-back option gets its reason', async () => {
  answerWith(optionAnswers(entry => entry.key.includes('2 years ago')));
  const { store } = renderExplore(optionState());
  await checked();
  expect(checkCalls()).toHaveLength(1);
  expect(
    lastCheckBody().charts.map((chart: { key: string }) => chart.key),
  ).toEqual([
    'explore',
    'opt:time_compare:1 year ago',
    'opt:time_compare:2 years ago',
    'opt:time_compare:inherit',
  ]);
  await waitFor(() =>
    expect(store.getState().explore.timeRangeCheck?.status).toBe('valid'),
  );
  expect(reasonsOf(store)).toEqual({
    time_compare: {
      '2 years ago': expect.stringContaining('Time comparison "2 years ago"'),
    },
  });
});

test('an inherit option is judged like the others', async () => {
  answerWith(optionAnswers(entry => entry.key.endsWith(':inherit')));
  const { store } = renderExplore(optionState());
  await checked();
  await waitFor(() =>
    expect(Object.keys(reasonsOf(store)?.time_compare ?? {})).toEqual([
      'inherit',
    ]),
  );
});

test('a main range that breaks a limit gives no option reasons', async () => {
  server.answer = LAST_45_DAYS;
  answerWith(optionAnswers(() => true));
  const { store } = renderExplore(optionState({}, 'Last 45 days'));
  await checked();
  await waitFor(() =>
    expect(store.getState().explore.timeRangeCheck?.status).toBe('invalid'),
  );
  expect(reasonsOf(store)).toEqual({});
});

test('the sibling control is emptied in each option entry, so its selection gives the other control no reasons', async () => {
  answerWith(
    optionAnswers(
      entry =>
        (entry.query_context.form_data.time_compare_b as string[])[0] ===
        '2 years ago',
    ),
  );
  const mixed = optionState({
    time_compare_b: {
      value: ['2 years ago'],
      type: 'SelectControl',
      multi: true,
      label: 'Time shift B',
      choices: [
        ['1 year ago', '1 year ago'],
        ['2 years ago', '2 years ago'],
      ],
    },
  });
  const { store } = renderExplore(mixed);
  await checked();
  const { charts } = lastCheckBody() as ChartsBody;
  const forA = charts.filter(chart =>
    chart.key.startsWith('opt:time_compare:'),
  );
  expect(forA.length).toBeGreaterThan(0);
  forA.forEach(chart =>
    expect(chart.query_context.form_data.time_compare_b).toEqual([]),
  );
  await waitFor(() =>
    expect(store.getState().explore.timeRangeCheck?.status).not.toBe('pending'),
  );
  expect(reasonsOf(store)?.time_compare).toBeUndefined();
});

test('an option entry the server could not read gives no reason and leaves the main status', async () => {
  answerWith(
    optionAnswers(
      () => true,
      key => key.startsWith('opt:'),
    ),
  );
  const { store } = renderExplore(optionState());
  await checked();
  await waitFor(() =>
    expect(store.getState().explore.timeRangeCheck?.status).toBe('valid'),
  );
  expect(reasonsOf(store)).toEqual({});
});

test('while the next check is pending the last reasons stay', async () => {
  let release: () => void = () => {};
  fetchMock.removeRoutes();
  mockRoutes(
    undefined,
    () =>
      new Promise(resolve => {
        release = () => resolve(chartRangesAnswer(server.answer));
      }),
  );
  const initial = optionState({}, 'Last week', {
    explore: { timeRangeCheck: SEEDED },
  });
  const { store } = renderExplore(initial);
  await checked();
  expect(store.getState().explore.timeRangeCheck?.status).toBe('pending');
  expect(reasonsOf(store)).toEqual(SEEDED.optionReasons);
  await act(async () => release());
});

test('no reasons are kept when no answer will follow (limits failed to load)', async () => {
  const initial = optionState({}, 'Last week', {
    limits: { status: 'failed' },
    explore: { timeRangeCheck: SEEDED },
  });
  const { store } = renderExplore(initial);
  await settle();
  expect(reasonsOf(store)).toEqual({});
});

test('no reasons are kept when the dashboard limits failed to load', async () => {
  server.dashboardId = 7;
  fetchMock.get(DASHBOARD, 503);
  const initial = optionState({}, 'Last week', {
    formData: { dashboardId: 7 },
    explore: { timeRangeCheck: SEEDED },
  });
  const { store } = renderExplore(initial);
  await checked();
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(DASHBOARD)).toHaveLength(1),
  );
  await settle();
  expect(reasonsOf(store)).toEqual({});
});
