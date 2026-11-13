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
import {
  ChartMetadata,
  FeatureFlag,
  getChartComponentRegistry,
  getChartTransformPropsRegistry,
  getChartControlPanelRegistry,
  getChartMetadataRegistry,
  isFeatureEnabled,
  isMatrixifyEnabled,
  VizType,
} from '@superset-ui/core';
import { Router, Route } from 'react-router-dom';
import { createMemoryHistory } from 'history';
import {
  act,
  createStore,
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import type { Store } from 'redux';
import type { ExploreTimeRangeLimits } from 'src/explore/actions/timeRangeLimitsActions';
import type { ExploreState } from 'src/explore/reducers/exploreReducer';
import type { ChartState } from 'src/explore/types';
import * as unsavedChangesPrompt from 'src/hooks/useUnsavedChangesPrompt';
import ExploreViewContainer from '.';

export const mockIsFeatureEnabled = isFeatureEnabled as jest.Mock;
export const mockIsMatrixifyEnabled = isMatrixifyEnabled as jest.Mock;

// The check's debounce (`CHECK_DEBOUNCE_MS`).
export const CHECK_DEBOUNCE_MS = 300;

export const MODERN = 'guarded_chart' as VizType;

export const SPAN_30 = {
  max_span: { quantity: 30, time_grain: 'P1D' },
  max_look_back: null,
  max_look_forward: null,
};

export const LOADED: ExploreTimeRangeLimits = {
  status: 'loaded',
  levels: [
    { source: 'global', policy: SPAN_30 },
    { source: 'dataset', policy: null },
  ],
  timezone: 'UTC',
  datasetId: 1,
};

export const CHART_RANGES = 'glob:*/api/v1/time_range_limits/chart_ranges/';
export const CHART_DATA = /\/api\/v1\/chart\/data/;
export const DASHBOARD = 'glob:*/api/v1/dashboard/7/time_range_limits/';
export const EXPLORE_GET = /\/api\/v1\/explore\/\?datasource_id=/;

export const NOW = {
  now: '2025-05-31T14:30:00',
  today: '2025-05-31T00:00:00',
  timezone: 'UTC',
};

export type Answer = {
  since: string | null;
  until: string | null;
  source?: object[] | null;
}[];

export const LAST_WEEK: Answer = [
  { since: '2025-05-24T00:00:00', until: '2025-05-31T00:00:00' },
];
export const LAST_45_DAYS: Answer = [
  { since: '2025-04-16T00:00:00', until: '2025-05-31T00:00:00' },
];

// What the mocked server answers; each test file resets it before each test.
export const server = {
  answer: LAST_WEEK,
  dashboardId: null as number | null,
  datasetId: 1,
};

export const chartRangesAnswer = (ranges: Answer) => ({
  result: {
    ...NOW,
    charts: [
      {
        key: 'explore',
        status: 'ok',
        ranges: ranges.map(item => ({
          time_offset: null,
          source: [{ kind: 'adhoc_filter', query_index: 0, index: 0 }],
          ...item,
        })),
        dataset_id: server.datasetId,
        dashboard_id: server.dashboardId,
      },
    ],
  },
});

export const controls = (filter = 'Last week') => ({
  datasource: { value: '1__table' },
  viz_type: { value: MODERN },
  slice_id: { value: 1 },
  adhoc_filters: {
    value: [
      {
        clause: 'WHERE',
        subject: 'ds',
        operator: 'TEMPORAL_RANGE',
        comparator: filter,
        expressionType: 'SIMPLE',
      },
    ],
    label: 'Filters',
  },
  color_scheme: { value: 'a', renderTrigger: true },
});

export const state = ({
  limits = LOADED as ExploreTimeRangeLimits | null,
  formData = {},
  queriesResponse = null as object[] | null,
  explore = {},
} = {}) => ({
  explore: {
    controls: controls(),
    datasource: {
      id: 1,
      type: 'table',
      datasource_name: 'events',
      columns: [{ column_name: 'ds', is_dttm: true }],
      metrics: [{ id: 1, metric_name: 'count' }],
    },
    isStarred: false,
    slice: { slice_id: 1 },
    form_data: { datasource: '1__table', viz_type: MODERN, ...formData },
    can_overwrite: true,
    can_add: true,
    ...(limits && { timeRangeLimits: limits }),
    ...explore,
  },
  charts: {
    1: {
      id: 1,
      latestQueryFormData: { datasource: '1__table' },
      queriesResponse,
      chartStatus: queriesResponse ? 'rendered' : null,
    },
  },
  user: { userId: 1 },
  common: { conf: { SUPERSET_WEBSERVER_TIMEOUT: 60 } },
  datasources: {},
  saveModal: { isVisible: false },
  dataMask: {},
});

export const mockExploreLocation = (search = '') =>
  Object.defineProperty(window, 'location', {
    get() {
      return {
        pathname: '/explore/',
        search,
        protocol: 'http:',
        host: 'localhost',
        hostname: 'localhost',
        href: `http://localhost/explore/${search}`,
        origin: 'http://localhost',
      };
    },
  });

export const renderExplore = (initialState = state(), search = '') => {
  mockExploreLocation(search);
  const store = createStore(initialState, reducerIndex);
  const history = createMemoryHistory({
    initialEntries: [`/explore/${search}`],
  });
  const result = render(
    <Router history={history}>
      <Route>
        <ExploreViewContainer />
      </Route>
    </Router>,
    { useRedux: true, useDnd: true, store },
  );
  return {
    ...result,
    store: store as unknown as Store<{
      explore: ExploreState;
      charts: Record<number, ChartState>;
    }>,
  };
};

export const chartDataCalls = () =>
  fetchMock.callHistory.calls(CHART_DATA).length;
export const checkCalls = () => fetchMock.callHistory.calls(CHART_RANGES);
export const lastCheckBody = () =>
  JSON.parse(String(checkCalls().at(-1)?.options.body));
export const updateChart = () =>
  screen.getByRole('button', { name: /^(Update|Create) chart$/ });
export const pressEnter = (modifier: {
  ctrlKey?: boolean;
  metaKey?: boolean;
}) => fireEvent.keyDown(document, { key: 'Enter', keyCode: 13, ...modifier });
export const findUpdateChart = () =>
  screen.findByRole('button', { name: /^(Update|Create) chart$/ });
export const settle = () =>
  act(
    () => new Promise(resolve => setTimeout(resolve, CHECK_DEBOUNCE_MS + 50)),
  );
export const checked = async (count = 1) => {
  await waitFor(() =>
    expect(checkCalls().length).toBeGreaterThanOrEqual(count),
  );
  await settle();
};

export function registerCharts() {
  getChartComponentRegistry().registerValue(MODERN, () => (
    <div data-test="guarded-chart">chart</div>
  ));
  getChartTransformPropsRegistry().registerValue(MODERN, () => ({}));
  getChartControlPanelRegistry().registerValue(MODERN, {
    controlPanelSections: [],
  });
  getChartMetadataRegistry().registerValue(
    MODERN,
    new ChartMetadata({
      name: 'table',
      thumbnail: '.png',
    }),
  );
}

export const mockRoutes = (
  chartData: object = {
    result: [{ data: [], colnames: [], coltypes: [], rowcount: 0 }],
  },
  chartRanges: number | ((call: never) => object) = () =>
    chartRangesAnswer(server.answer),
) => {
  fetchMock.post('glob:*/api/v1/explore/form_data*', { key: 'k' });
  fetchMock.put('glob:*/api/v1/explore/form_data*', { key: 'k' });
  fetchMock.get('glob:*/api/v1/chart/favorite_status*', { result: [] });
  fetchMock.get('glob:*/api/v1/chart/1', { result: {} });
  fetchMock.post(CHART_RANGES, chartRanges);
  fetchMock.post(CHART_DATA, chartData);
};

export function resetServer() {
  server.answer = LAST_WEEK;
  server.dashboardId = null;
  server.datasetId = 1;
  mockIsFeatureEnabled.mockImplementation(
    flag => flag === FeatureFlag.TimeRangeLimits,
  );
  mockIsMatrixifyEnabled.mockReturnValue(false);
  mockRoutes();
}

export function clearServer() {
  fetchMock.clearHistory();
  fetchMock.removeRoutes();
}

export const RENDERED = [
  { data: [{ a: 1 }], colnames: ['a'], coltypes: [0], is_cached: true },
];

export const OPEN_RANGE: Answer = [{ since: null, until: null, source: null }];
export const OPEN_TEXT =
  'Choose a start and an end date. Time range limits are on.';

// a chart type with control panel sections, for the focus moves.
export const SECTIONS = 'guarded_sections' as VizType;
export const SPAN_TEXT = /Range can't be longer than 30 days/;
export const REASON_ID = 'explore-time-range-reason';

export const textControl = (label: string, extra = {}) => ({
  type: 'TextControl',
  label,
  ...extra,
});

export function registerSectionsChart() {
  getChartComponentRegistry().registerValue(SECTIONS, () => (
    <div data-test="guarded-chart">chart</div>
  ));
  getChartTransformPropsRegistry().registerValue(SECTIONS, () => ({}));
  getChartMetadataRegistry().registerValue(
    SECTIONS,
    new ChartMetadata({ name: 'sections', thumbnail: '.png' }),
  );
  getChartControlPanelRegistry().registerValue(SECTIONS, {
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [
          [{ name: 'adhoc_filters', config: textControl('Filters') }],
        ],
      },
      {
        label: 'Advanced analytics',
        controlSetRows: [
          [{ name: 'time_compare', config: textControl('Time comparison') }],
        ],
      },
      {
        label: 'Chart Options',
        expanded: true,
        controlSetRows: [
          [
            {
              name: 'color_scheme',
              config: textControl('Color scheme', { renderTrigger: true }),
            },
          ],
        ],
      },
    ],
  });
}

export const sectionsState = (options: Parameters<typeof state>[0] = {}) => {
  const initial = state({ ...options, formData: { viz_type: SECTIONS } });
  const base = controls();
  initial.explore.controls = {
    ...base,
    viz_type: { value: SECTIONS },
    adhoc_filters: { ...base.adhoc_filters, type: 'TextControl' },
    time_compare: { value: '', type: 'TextControl', label: 'Time comparison' },
    color_scheme: {
      value: 'a',
      type: 'TextControl',
      label: 'Color scheme',
      renderTrigger: true,
    },
  } as never;
  return initial;
};

// The unsaved-changes prompt opens its modal on the URL push of a run in
// this harness and takes focus; the focus tests leave it out.
let promptSpy: jest.SpyInstance | undefined;
export const withoutUnsavedPrompt = () => {
  promptSpy = jest
    .spyOn(unsavedChangesPrompt, 'useUnsavedChangesPrompt')
    .mockReturnValue({
      showModal: false,
      setShowModal: jest.fn(),
      handleConfirmNavigation: jest.fn(),
      handleSaveAndCloseModal: jest.fn(),
      triggerManualSave: jest.fn(),
    });
};
export function restoreUnsavedPrompt() {
  promptSpy?.mockRestore();
  promptSpy = undefined;
}

export const controlOf = (name: string) =>
  document.querySelector(`.Control[data-test="${name}"]`);
export const focusIn = (name: string) =>
  expect(controlOf(name)?.contains(document.activeElement)).toBe(true);

export const RANGE_REJECTED = {
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
};

// The page-open run passes; the next chart request gets a time range 400.
export function rejectSecondRun() {
  fetchMock.removeRoutes();
  let runs = 0;
  mockRoutes(() => {
    runs += 1;
    return runs === 1
      ? { result: [{ data: [], colnames: [], coltypes: [], rowcount: 0 }] }
      : RANGE_REJECTED;
  });
  fetchMock.get(EXPLORE_GET, {
    result: { time_range_limits: { global: SPAN_30, dataset: null } },
  });
}
