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
// Imported first: loading this before 'spec/helpers/testing-library' or
// '@superset-ui/core' ensures mockAntdWithDesktopBreakpoint is defined
// before anything transitively requires (and thus mocks) 'antd'.
import { mockAntdWithDesktopBreakpoint } from 'spec/helpers/mobileTestUtils';
import fetchMock from 'fetch-mock';
import rison from 'rison';
import {
  act,
  render,
  within,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import * as dataMaskActions from 'src/dataMask/actions';
import DashboardBuilder from 'src/dashboard/components/DashboardBuilder/DashboardBuilder';
import useStoredSidebarWidth from 'src/components/ResizableSidebar/useStoredSidebarWidth';
import {
  fetchFaveStar,
  setActiveTab,
  setDirectPathToChild,
} from 'src/dashboard/actions/dashboardState';
import { setTimeRangeUserApply } from 'src/dashboard/actions/timeRangeLimits';
import { dashboardInfoChanged } from 'src/dashboard/actions/dashboardInfo';
import { dashboardLayout as undoableDashboardLayout } from 'spec/fixtures/mockDashboardLayout';
import { storeWithState } from 'spec/fixtures/mockStore';
import mockState from 'spec/fixtures/mockState';
import chartQueries, { sliceId } from 'spec/fixtures/mockChartQueries';
import * as useNativeFiltersModule from './state';
import {
  LIMITS_ALERT_TEXT_ID,
  LIMITS_FAILED_TEXT_ID,
} from './TimeRangeLimitsAlert';

fetchMock.get('glob:*/csstemplateasyncmodelview/api/read', {});
fetchMock.put('glob:*/api/v1/dashboard/*', {});
// Add mock for logging endpoint
fetchMock.post('glob:*/log/?*', {});

// Mock useBreakpoint to return desktop breakpoints (prevents mobile rendering)
jest.mock('antd', () => mockAntdWithDesktopBreakpoint());

jest.mock('src/dashboard/actions/dashboardState', () => ({
  ...jest.requireActual('src/dashboard/actions/dashboardState'),
  fetchFaveStar: jest.fn(),
  setActiveTab: jest.fn(),
  setDirectPathToChild: jest.fn(),
}));
jest.mock('src/components/ResizableSidebar/useStoredSidebarWidth');

// mock following dependent components to fix the prop warnings
jest.mock('@superset-ui/core/components/Select/Select', () => {
  const MockSelect = () => <div data-test="mock-select" />;
  MockSelect.displayName = 'MockSelect';
  return MockSelect;
});
jest.mock('@superset-ui/core/components/Select/AsyncSelect', () => {
  const MockAsyncSelect = () => <div data-test="mock-async-select" />;
  MockAsyncSelect.displayName = 'MockAsyncSelect';
  return MockAsyncSelect;
});
jest.mock('@superset-ui/core/components/PageHeaderWithActions', () => {
  const MockPageHeaderWithActions = () => (
    <div data-test="mock-page-header-with-actions" />
  );
  MockPageHeaderWithActions.displayName = 'MockPageHeaderWithActions';
  return {
    PageHeaderWithActions: MockPageHeaderWithActions,
  };
});
jest.mock(
  'src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigModal',
  () => {
    const MockFiltersConfigModal = () => (
      <div data-test="mock-filters-config-modal" />
    );
    MockFiltersConfigModal.displayName = 'MockFiltersConfigModal';
    return MockFiltersConfigModal;
  },
);
jest.mock('src/dashboard/components/BuilderComponentPane', () => {
  const MockBuilderComponentPane = () => (
    <div data-test="mock-builder-component-pane" />
  );
  MockBuilderComponentPane.displayName = 'MockBuilderComponentPane';
  return MockBuilderComponentPane;
});
jest.mock('src/dashboard/components/nativeFilters/FilterBar', () => {
  const MockFilterBar = () => <div data-test="mock-filter-bar" />;
  MockFilterBar.displayName = 'MockFilterBar';
  return MockFilterBar;
});
// Exposes the sticky offset the builder hands to tab bars in the grid.
jest.mock('src/dashboard/containers/DashboardGrid', () => {
  const { useContext } = jest.requireActual('react');
  const { StickyTabsOffsetContext } = jest.requireActual(
    'src/dashboard/components/gridComponents/TabsRenderer/StickyTabsOffsetContext',
  );
  const MockDashboardGrid = () => {
    const stickyTabsOffset = useContext(StickyTabsOffsetContext);
    return (
      <div
        data-test="mock-dashboard-grid"
        data-sticky-tabs-offset={stickyTabsOffset ?? 'none'}
      />
    );
  };
  MockDashboardGrid.displayName = 'MockDashboardGrid';
  return MockDashboardGrid;
});
// The real component renders null, so mock it with a visible marker to let
// tests assert whether DashboardBuilder mounts it.
jest.mock('src/features/versionHistory/DashboardVersionHistory', () => ({
  __esModule: true,
  // Renders a marker inside the column so placement can be asserted; the
  // real component's restore modal portals out, which is irrelevant here.
  default: jest.fn(() => <aside data-test="mock-dashboard-version-history" />),
}));
jest.mock('src/features/versionHistory/VersionHistoryPanel', () => ({
  __esModule: true,
  default: () => <aside data-test="mock-history-panel" />,
}));
jest.mock('src/features/versionHistory/useDashboardVersionPreview', () => ({
  useDashboardVersionPreview: jest.fn(),
}));
jest.mock('src/features/versionHistory/useVersionActions', () => ({
  useVersionActions: () => ({
    requestRestore: jest.fn(),
    openAsNew: jest.fn(),
    restoreModal: null,
  }),
}));
jest.mock('src/features/versionHistory/useVersionActivity', () => ({
  useVersionActivity: () => ({
    records: [],
    timeline: [],
    newestGroup: null,
    currentVersionStatus: 'empty',
    count: 0,
    isLoading: false,
    error: null,
    hasMore: false,
    truncated: false,
    loadMore: jest.fn(),
    refresh: jest.fn(),
  }),
}));
jest.mock('src/features/versionHistory/api', () => ({
  ...jest.requireActual('src/features/versionHistory/api'),
  fetchDashboardHydrationData: jest.fn(),
}));
jest.mock('src/dashboard/actions/hydrate', () => ({
  ...jest.requireActual('src/dashboard/actions/hydrate'),
  hydrateDashboard: jest.fn(() => ({ type: 'TEST_HYDRATE_DASHBOARD' })),
}));

jest.mock('src/dashboard/components/Header/HeadlessAutoRefresh', () => {
  const MockHeadlessAutoRefresh = () => (
    <div data-test="mock-headless-auto-refresh" />
  );
  MockHeadlessAutoRefresh.displayName = 'MockHeadlessAutoRefresh';
  return MockHeadlessAutoRefresh;
});
jest.mock('src/hooks/useIsMobile', () => ({
  ...jest.requireActual('src/hooks/useIsMobile'),
  useIsMobile: jest.fn().mockReturnValue(false),
}));
jest.mock('src/dashboard/util/isEmbedded', () => ({
  isEmbedded: jest.fn(() => false),
}));

const LIMITS_DASHBOARD_ID = mockState.dashboardInfo.id;
const LIMITS_GET = `glob:*/api/v1/dashboard/${LIMITS_DASHBOARD_ID}/time_range_limits/`;
const TIME_FILTER = 'NATIVE_FILTER-time';
const NO_RULES = {
  max_span: null,
  max_look_back: null,
  max_look_forward: null,
};
const SPAN_90_DAYS = {
  ...NO_RULES,
  max_span: { quantity: 90, time_grain: 'P1D' },
};
const ALERT_SERVER: Record<string, [string, string]> = {
  'today : now': ['2026-10-30T00:00:00', '2026-10-30T12:00:00'],
  'Last year': ['2025-10-30T00:00:00', '2026-10-30T00:00:00'],
  'Last week': ['2026-10-23T00:00:00', '2026-10-30T00:00:00'],
  'DATEADD(DATETIME("today"), -90, day) : today': [
    '2026-08-01T00:00:00',
    '2026-10-30T00:00:00',
  ],
  'Next week': ['2026-10-30T00:00:00', '2026-11-06T00:00:00'],
};
const SPAN_FAILURE = {
  reason: 'MAX_SPAN_EXCEEDED',
  rule: 'max_span',
  field: 'range',
  limit: { source: 'dashboard', quantity: 90, time_grain: 'P1D' },
  message: "Range can't be longer than 90 days. This one is 365 days.",
  range: {
    since: '2025-10-30T00:00:00',
    until: '2026-10-30T00:00:00',
    time_offset: null,
    source: [{ kind: 'time_shift', query_index: 0, index: 0 }],
  },
};
const ALERT_TEXT =
  'This link opened a time range longer than this dashboard allows (90 days).';
const CHART_ALERT_TEXT =
  'A chart on this dashboard uses a time range longer than this dashboard allows (90 days).';

const limitSpies: jest.SpyInstance[] = [];

function limitsDashboardState({
  value = 'Last year',
  status = 'loaded',
  dashboard = SPAN_90_DAYS,
  holds = {},
  global = NO_RULES,
  datasets = [],
}: {
  value?: string;
  status?: string;
  dashboard?: Record<string, unknown>;
  holds?: Record<string, unknown>;
  global?: Record<string, unknown>;
  datasets?: Record<string, unknown>[];
} = {}) {
  return {
    ...mockState,
    dashboardLayout: undoableDashboardLayout,
    dataMask: {
      [TIME_FILTER]: {
        id: TIME_FILTER,
        filterState: { value },
        extraFormData: { time_range: value },
      },
    },
    nativeFilters: {
      filters: {
        [TIME_FILTER]: {
          id: TIME_FILTER,
          name: 'Time range',
          filterType: 'filter_time',
          type: 'NATIVE_FILTER',
          chartsInScope: [],
          targets: [{}],
        },
      },
      filtersState: {},
    },
    timeRangeLimits: {
      status,
      dashboardId: LIMITS_DASHBOARD_ID,
      request: 1,
      payload:
        status === 'loaded'
          ? {
              global,
              dashboard,
              datasets,
              timezone: 'UTC',
            }
          : null,
      charts: holds,
    },
  };
}

function renderLimitsDashboard(
  state: ReturnType<typeof limitsDashboardState>,
  { filtersOpen = true } = {},
) {
  const spy = jest.spyOn(useNativeFiltersModule, 'useNativeFilters');
  limitSpies.push(spy);
  spy.mockReturnValue({
    showDashboard: true,
    missingInitialFilters: [],
    dashboardFiltersOpen: filtersOpen,
    toggleDashboardFiltersOpen: jest.fn(),
    nativeFiltersEnabled: true,
    hasFilters: true,
  });
  const store = storeWithState(state);
  render(<DashboardBuilder />, {
    useRedux: true,
    store,
    useDnd: true,
    useTheme: true,
    useRouter: true,
  });
  return store;
}

// Stands in for the mocked filter bar's title, the target of "Pick a range".
function addFilterTitle() {
  const title = document.createElement('div');
  title.id = `filter-name-${TIME_FILTER}`;
  document.body.appendChild(title);
  return title;
}

function prepareLimits() {
  (useStoredSidebarWidth as jest.Mock).mockImplementation(() => [
    100,
    jest.fn(),
  ]);
  (fetchFaveStar as jest.Mock).mockReturnValue({ type: 'mock-action' });
  (setActiveTab as jest.Mock).mockReturnValue({ type: 'mock-action' });
  (setDirectPathToChild as jest.Mock).mockReturnValue({
    type: 'mock-direct-path',
  });
  (setDirectPathToChild as jest.Mock).mockClear();
  window.featureFlags = { TIME_RANGE_LIMITS: true };
  fetchMock.get(
    'glob:*/api/v1/time_range/*',
    ({ url }: { url: string }) => {
      const request = rison.decode(new URL(url).searchParams.get('q')!) as {
        timeRange: string;
      }[];
      return {
        result: request.map(({ timeRange }) => {
          const [since, until] = ALERT_SERVER[timeRange] ?? ['', ''];
          return { since, until, timeRange, shift: null };
        }),
      };
    },
    { name: 'alert-time-range' },
  );
  fetchMock.clearHistory();
}

afterEach(() => {
  window.featureFlags = {};
  fetchMock.removeRoute('alert-time-range');
  fetchMock.removeRoute('alert-limits');
  limitSpies.splice(0).forEach(spy => spy.mockRestore());
});

test('limits failed: the limits-failed alert with Retry, one GET per click', async () => {
  prepareLimits();
  fetchMock.get(LIMITS_GET, 500, { name: 'alert-limits' });
  renderLimitsDashboard(limitsDashboardState({ status: 'failed' }));

  expect(
    screen.getByText(
      'Time range limits could not be loaded. Queries are paused to protect the database.',
    ),
  ).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByRole('button', { name: 'Retry' });
  expect(fetchMock.callHistory.calls('alert-limits')).toHaveLength(1);

  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByRole('button', { name: 'Retry' });
  expect(fetchMock.callHistory.calls('alert-limits')).toHaveLength(2);
});

test('chart ranges could not be checked: the limits-failed alert, Retry checks those charts again once per click', async () => {
  prepareLimits();
  fetchMock.get(
    LIMITS_GET,
    { result: { global: NO_RULES, dashboard: SPAN_90_DAYS, datasets: [] } },
    { name: 'alert-limits' },
  );
  fetchMock.post(
    'glob:*/api/v1/time_range_limits/chart_ranges/',
    { status: 500, body: {} },
    { name: 'alert-chart-ranges' },
  );
  const state = limitsDashboardState({
    value: 'Last week',
    holds: {
      [sliceId]: {
        signature: JSON.stringify(chartQueries[sliceId].form_data),
        status: 'unavailable',
      },
    },
  });
  renderLimitsDashboard({
    ...state,
    charts: {
      ...state.charts,
      [sliceId]: { ...state.charts[sliceId], triggerQuery: true },
    },
  });

  expect(
    screen.getByText(
      'Time range limits could not be loaded. Queries are paused to protect the database.',
    ),
  ).toBeInTheDocument();

  try {
    const retry = screen.getByRole('button', { name: 'Retry' });
    await userEvent.click(retry);
    await waitFor(() =>
      expect(fetchMock.callHistory.calls('alert-chart-ranges')).toHaveLength(1),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Retry' })).not.toHaveClass(
        'ant-btn-loading',
      ),
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBe(retry);

    await userEvent.click(retry);
    await waitFor(() =>
      expect(fetchMock.callHistory.calls('alert-chart-ranges')).toHaveLength(2),
    );
    expect(fetchMock.callHistory.calls('alert-limits')).toHaveLength(2);
  } finally {
    fetchMock.removeRoute('alert-chart-ranges');
  }
});

test('a dataset level that could not be read: Retry loads the limits again, then the chart is checked and runs', async () => {
  prepareLimits();
  const datasetId = Number(
    String(chartQueries[sliceId].form_data.datasource).split('__')[0],
  );
  const dataset = { id: datasetId, name: 'birth_names', policy: NO_RULES };
  fetchMock.get(
    LIMITS_GET,
    {
      result: {
        global: NO_RULES,
        dashboard: SPAN_90_DAYS,
        datasets: [dataset],
        timezone: 'UTC',
      },
    },
    { name: 'alert-limits' },
  );
  fetchMock.post(
    'glob:*/api/v1/time_range_limits/chart_ranges/',
    ({ options }: { options: { body?: unknown } }) => ({
      result: {
        now: '2026-10-30T12:00:00',
        today: '2026-10-30T00:00:00',
        timezone: 'UTC',
        charts: JSON.parse(String(options.body)).charts.map(
          (entry: { key: string }) => ({
            key: entry.key,
            status: 'ok',
            dataset_id: datasetId,
            dashboard_id: LIMITS_DASHBOARD_ID,
            ranges: [
              {
                since: '2026-10-23T00:00:00',
                until: '2026-10-30T00:00:00',
                time_offset: null,
                source: [{ kind: 'granularity', query_index: 0, index: null }],
              },
            ],
          }),
        ),
      },
    }),
    { name: 'alert-chart-ranges' },
  );
  const state = limitsDashboardState({
    value: 'Last week',
    holds: {
      [sliceId]: {
        signature: JSON.stringify(chartQueries[sliceId].form_data),
        status: 'unavailable',
      },
    },
    datasets: [
      {
        ...dataset,
        error: {
          message: 'Time range limits could not be loaded.',
          error_type: 'TIME_RANGE_LIMIT_ERROR',
        },
      },
    ],
  });
  const store = renderLimitsDashboard({
    ...state,
    charts: {
      ...state.charts,
      [sliceId]: { ...state.charts[sliceId], triggerQuery: true },
    },
  });

  try {
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(store.getState().timeRangeLimits.charts[sliceId].status).toBe(
        'valid',
      ),
    );
    expect(fetchMock.callHistory.calls('alert-limits')).toHaveLength(1);
    expect(fetchMock.callHistory.calls('alert-chart-ranges')).toHaveLength(1);
    await waitFor(() =>
      expect(
        screen.queryByText(
          'Time range limits could not be loaded. Queries are paused to protect the database.',
        ),
      ).not.toBeInTheDocument(),
    );
  } finally {
    fetchMock.removeRoute('alert-chart-ranges');
  }
});

test('limits loading: the dashboard content is busy and has no alert', async () => {
  prepareLimits();
  renderLimitsDashboard(limitsDashboardState({ status: 'loading' }));

  expect(screen.getByTestId('dashboard-content-wrapper')).toHaveAttribute(
    'aria-busy',
    'true',
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a Time Range value over the span: limits-failed alert with both buttons, focus goes to the filter', async () => {
  prepareLimits();
  const title = addFilterTitle();
  try {
    renderLimitsDashboard(limitsDashboardState());

    expect(await screen.findByText(ALERT_TEXT)).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Use last 90 days' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Pick a range' }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('dashboard-content-wrapper').firstElementChild,
    ).toBe(screen.getByTestId('time-range-limits-alert'));
    await waitFor(() =>
      expect(setDirectPathToChild).toHaveBeenCalledWith([TIME_FILTER]),
    );
    expect(setDirectPathToChild).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Pick a range' }));
    expect(setDirectPathToChild).toHaveBeenCalledTimes(2);
    expect(setDirectPathToChild).toHaveBeenLastCalledWith([TIME_FILTER]);
  } finally {
    title.remove();
  }
});

test('"Use last 90 days" sets the value on the filter and applies it, without error keys', async () => {
  prepareLimits();
  const updateDataMaskSpy = jest.spyOn(dataMaskActions, 'updateDataMask');
  limitSpies.push(updateDataMaskSpy);
  const store = renderLimitsDashboard(limitsDashboardState());

  await userEvent.click(
    await screen.findByRole('button', { name: 'Use last 90 days' }),
  );

  const value = 'DATEADD(DATETIME("today"), -90, day) : today';
  expect(updateDataMaskSpy).toHaveBeenCalledWith(TIME_FILTER, {
    extraFormData: { time_range: value },
    filterState: { value },
  });
  expect(store.getState().dataMask[TIME_FILTER]).toEqual({
    id: TIME_FILTER,
    extraFormData: { time_range: value },
    filterState: { value },
    ownState: {},
  });
  await waitFor(() =>
    expect(screen.queryByText(ALERT_TEXT)).not.toBeInTheDocument(),
  );
});

test('"Use last 90 days" is hidden when that value breaks another rule', async () => {
  prepareLimits();
  renderLimitsDashboard(
    limitsDashboardState({
      dashboard: {
        ...SPAN_90_DAYS,
        max_look_back: { quantity: 30, time_grain: 'P1D' },
      },
    }),
  );

  expect(await screen.findByText(ALERT_TEXT)).toBeInTheDocument();
  await waitFor(() => expect(screen.getAllByRole('button')).toBeTruthy());
  expect(
    screen.queryByRole('button', { name: 'Use last 90 days' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Pick a range' })).toBeVisible();
});

[
  {
    value: 'Next week',
    rules: { max_look_forward: { quantity: 0, time_grain: 'P1D' } },
    text: 'This link opened a time range that ends later than this dashboard allows (today).',
  },
  {
    value: 'Last year',
    rules: { max_look_back: { quantity: 0, time_grain: 'P1D' } },
    text: 'This link opened a time range that starts earlier than this dashboard allows (today).',
  },
  {
    value: 'Last year',
    rules: { max_look_back: { quantity: 0, time_grain: 'PT1H' } },
    text: 'This link opened a time range that starts earlier than this dashboard allows (now).',
  },
  {
    value: 'Last year',
    rules: { max_look_back: { quantity: 30, time_grain: 'P1D' } },
    text: 'This link opened a time range that starts earlier than this dashboard allows (30 days).',
  },
  {
    value: '',
    rules: { max_look_back: { quantity: 30, time_grain: 'P1D' } },
    text: 'This link opened a time range with no start or end date.',
  },
].forEach(({ value, rules, text }) =>
  test(`another reason has its own sentence: ${text}`, async () => {
    prepareLimits();
    renderLimitsDashboard(
      limitsDashboardState({ value, dashboard: { ...NO_RULES, ...rules } }),
    );

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Pick a range' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Use last/ }),
    ).not.toBeInTheDocument();
  }),
);

test('a range from the chart itself: the same alert without buttons, focus stays where it was', async () => {
  prepareLimits();
  renderLimitsDashboard(
    limitsDashboardState({
      value: 'Last week',
      holds: {
        5: {
          signature: '{}',
          status: 'invalid',
          failures: [SPAN_FAILURE],
          attribution: { filterId: null, filterValue: null, chart: true },
        },
      },
    }),
  );

  expect(await screen.findByText(CHART_ALERT_TEXT)).toBeInTheDocument();
  expect(screen.queryByRole('button')).toBeNull();
  const wrapper = screen.getByTestId('time-range-limits-alert');
  const alert = within(wrapper).getByRole('alert');
  await act(() => new Promise(resolve => setTimeout(resolve, 300)));
  expect(alert).not.toHaveFocus();
  expect(wrapper.contains(document.activeElement)).toBe(false);
  expect(alert).not.toHaveAttribute('tabindex');
  expect(setDirectPathToChild).not.toHaveBeenCalled();
});

test('a chart with no start or end date of its own: the bounded range sentence, not the link one', async () => {
  prepareLimits();
  renderLimitsDashboard(
    limitsDashboardState({
      value: 'Last week',
      holds: {
        5: {
          signature: '{}',
          status: 'unbounded',
          failures: [
            {
              ...SPAN_FAILURE,
              reason: 'UNBOUNDED_RANGE',
              rule: null,
              limit: null,
              range: { ...SPAN_FAILURE.range, since: null, until: null },
            },
          ],
          attribution: { filterId: null, filterValue: null, chart: true },
        },
      },
    }),
  );

  expect(
    await screen.findByText(
      'This chart requires a bounded time range. Ask a dashboard editor to add or scope a time range filter.',
    ),
  ).toBeInTheDocument();
  expect(screen.queryByText(/This link opened/)).not.toBeInTheDocument();
});

test('bar open: focus waits until the bar lists the invalid filter', async () => {
  prepareLimits();
  renderLimitsDashboard(limitsDashboardState());
  await screen.findByRole('button', { name: 'Use last 90 days' });
  expect(setDirectPathToChild).not.toHaveBeenCalled();

  const title = addFilterTitle();
  try {
    await waitFor(() =>
      expect(setDirectPathToChild).toHaveBeenCalledWith([TIME_FILTER]),
    );
  } finally {
    title.remove();
  }
});

test('a chart held before the filter check answers: the filter case wins and focus goes to the filter once', async () => {
  prepareLimits();
  fetchMock.removeRoute('alert-time-range');
  fetchMock.get(
    'glob:*/api/v1/time_range/*',
    ({ url }: { url: string }) => {
      const request = rison.decode(new URL(url).searchParams.get('q')!) as {
        timeRange: string;
      }[];
      return new Promise(resolve =>
        setTimeout(
          () =>
            resolve({
              result: request.map(({ timeRange }) => {
                const [since, until] = ALERT_SERVER[timeRange] ?? ['', ''];
                return { since, until, timeRange, shift: null };
              }),
            }),
          300,
        ),
      );
    },
    { name: 'alert-time-range' },
  );
  const title = addFilterTitle();
  try {
    renderLimitsDashboard(
      limitsDashboardState({
        holds: {
          5: {
            signature: '{}',
            status: 'invalid',
            failures: [
              {
                ...SPAN_FAILURE,
                range: {
                  ...SPAN_FAILURE.range,
                  source: [{ kind: 'time_range', query_index: 0, index: null }],
                },
              },
            ],
            attribution: {
              filterId: TIME_FILTER,
              filterValue: 'Last year',
              chart: false,
            },
          },
        },
      }),
    );
    expect(
      screen.queryByTestId('time-range-limits-alert'),
    ).not.toBeInTheDocument();

    expect(
      await screen.findByRole(
        'button',
        { name: 'Use last 90 days' },
        { timeout: 2000 },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Pick a range' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(setDirectPathToChild).toHaveBeenCalledWith([TIME_FILTER]),
    );
    expect(setDirectPathToChild).toHaveBeenCalledTimes(1);
  } finally {
    title.remove();
  }
});

test('a chart judged after load shows the alert without moving focus', async () => {
  prepareLimits();
  const store = renderLimitsDashboard(
    limitsDashboardState({ value: 'Last week' }),
  );
  await waitFor(() =>
    expect(fetchMock.callHistory.calls('alert-time-range')).toHaveLength(1),
  );
  await new Promise(resolve => setTimeout(resolve, 100));
  const input = document.createElement('input');
  document.body.appendChild(input);
  try {
    input.focus();
    store.dispatch({
      type: 'CHART_RANGES_HOLD',
      dashboardId: LIMITS_DASHBOARD_ID,
      chartId: 7,
      hold: {
        signature: '{}',
        status: 'invalid',
        failures: [SPAN_FAILURE],
        attribution: { filterId: null, filterValue: null, chart: true },
      },
    });

    expect(await screen.findByText(CHART_ALERT_TEXT)).toBeInTheDocument();
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(input).toHaveFocus();
    expect(setDirectPathToChild).not.toHaveBeenCalled();
  } finally {
    input.remove();
  }
});

test('focus moves only once: a later render of the alert leaves it alone', async () => {
  prepareLimits();
  const title = addFilterTitle();
  try {
    const store = renderLimitsDashboard(limitsDashboardState());
    await waitFor(() =>
      expect(setDirectPathToChild).toHaveBeenCalledWith([TIME_FILTER]),
    );

    store.dispatch({
      type: 'CHART_RANGES_HOLD',
      dashboardId: LIMITS_DASHBOARD_ID,
      chartId: 9,
      hold: { signature: '{}', status: 'checking' },
    });
    await new Promise(resolve => setTimeout(resolve, 300));

    expect(setDirectPathToChild).toHaveBeenCalledTimes(1);
  } finally {
    title.remove();
  }
});

test('bar open, the filter not in the page (horizontal overflow): "Pick a range" asks the bar to show the filter', async () => {
  prepareLimits();
  renderLimitsDashboard(limitsDashboardState());
  await screen.findByRole('button', { name: 'Use last 90 days' });
  expect(setDirectPathToChild).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole('button', { name: 'Pick a range' }));

  expect(setDirectPathToChild).toHaveBeenCalledTimes(1);
  expect(setDirectPathToChild).toHaveBeenCalledWith([TIME_FILTER]);
});

test('with the filter bar collapsed, focus goes to the first button of the alert', async () => {
  prepareLimits();
  const title = addFilterTitle();
  try {
    renderLimitsDashboard(limitsDashboardState(), {
      filtersOpen: false,
    });

    const useLast = await screen.findByRole('button', {
      name: 'Use last 90 days',
    });
    await waitFor(() => expect(useLast).toHaveFocus());
    expect(setDirectPathToChild).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Pick a range' }));
    expect(useLast).toHaveFocus();
    expect(setDirectPathToChild).not.toHaveBeenCalled();
  } finally {
    title.remove();
  }
});

test('the alert goes once nothing is invalid', async () => {
  prepareLimits();
  const store = renderLimitsDashboard(limitsDashboardState());
  expect(await screen.findByText(ALERT_TEXT)).toBeInTheDocument();

  store.dispatch(
    dataMaskActions.updateDataMask(TIME_FILTER, {
      extraFormData: { time_range: 'Last week' },
      filterState: { value: 'Last week' },
    }),
  );

  await waitFor(() =>
    expect(screen.queryByText(ALERT_TEXT)).not.toBeInTheDocument(),
  );
});

test('flag off: no alert, no busy state, no time range check', async () => {
  prepareLimits();
  window.featureFlags = {};
  renderLimitsDashboard(limitsDashboardState({ status: 'failed' }));

  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByTestId('dashboard-content-wrapper')).not.toHaveAttribute(
    'aria-busy',
  );
  expect(fetchMock.callHistory.calls('alert-time-range')).toHaveLength(0);
});

const USE_LAST_VALUE = 'DATEADD(DATETIME("today"), -90, day) : today';

// A chart the server rejected for the Time Range filter's applied value.
const markedHold = (filterValue: string) => ({
  signature: '{}',
  status: 'rejected',
  failures: [
    {
      ...SPAN_FAILURE,
      range: {
        ...SPAN_FAILURE.range,
        source: [{ kind: 'time_range', query_index: 0, index: null }],
      },
    },
  ],
  attribution: { filterId: TIME_FILTER, filterValue, chart: false },
});

const holdChart = (hold: object, chartId = 5) => ({
  type: 'CHART_RANGES_HOLD',
  dashboardId: LIMITS_DASHBOARD_ID,
  chartId,
  hold,
});

const pause = (ms = 200) =>
  act(() => new Promise(resolve => setTimeout(resolve, ms)));

// The load's first judgement (no problem) has settled.
async function loadSettled() {
  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls('alert-time-range').length,
    ).toBeGreaterThan(0),
  );
  await pause();
}

// What a 400 for the applied value does: the chart is checked and sent, the
// server rejects it, the limits load again and the re-check marks the filter.
function rejectAfterApply(
  store: ReturnType<typeof renderLimitsDashboard>,
  value: string,
) {
  act(() => {
    store.dispatch(holdChart({ signature: '{}', status: 'checking' }));
    store.dispatch(holdChart({ signature: '{}', status: 'queried' }));
    store.dispatch(holdChart({ signature: '{}', status: 'rejected' }));
    store.dispatch({
      type: 'TIME_RANGE_LIMITS_LOADING',
      dashboardId: LIMITS_DASHBOARD_ID,
      request: 2,
    });
    store.dispatch({
      type: 'TIME_RANGE_LIMITS_LOADED',
      request: 2,
      payload: {
        global: NO_RULES,
        dashboard: SPAN_90_DAYS,
        datasets: [],
        timezone: 'UTC',
      },
    });
    store.dispatch(holdChart(markedHold(value)));
  });
}

test("a server rejection after the user's Apply filters moves focus once to the filter", async () => {
  prepareLimits();
  const title = addFilterTitle();
  try {
    const store = renderLimitsDashboard(
      limitsDashboardState({ value: 'Last week' }),
    );
    await loadSettled();
    expect(setDirectPathToChild).not.toHaveBeenCalled();

    act(() => {
      store.dispatch(setTimeRangeUserApply({ [TIME_FILTER]: 'Last week' }));
    });
    rejectAfterApply(store, 'Last week');

    await waitFor(() =>
      expect(setDirectPathToChild).toHaveBeenCalledWith([TIME_FILTER]),
    );
    expect(store.getState().timeRangeLimits.userApply).toBeUndefined();
    act(() => {
      store.dispatch(holdChart({ signature: '{}', status: 'checking' }, 9));
    });
    await pause();
    expect(setDirectPathToChild).toHaveBeenCalledTimes(1);
  } finally {
    title.remove();
  }
});

test('a server rejection after "Use last 90 days" moves focus to the filter again', async () => {
  prepareLimits();
  const title = addFilterTitle();
  try {
    const store = renderLimitsDashboard(limitsDashboardState());
    await waitFor(() => expect(setDirectPathToChild).toHaveBeenCalledTimes(1));

    await userEvent.click(
      screen.getByRole('button', { name: 'Use last 90 days' }),
    );
    expect(store.getState().timeRangeLimits.userApply?.filters).toEqual({
      [TIME_FILTER]: USE_LAST_VALUE,
    });
    await waitFor(() =>
      expect(screen.queryByText(ALERT_TEXT)).not.toBeInTheDocument(),
    );
    rejectAfterApply(store, USE_LAST_VALUE);

    await waitFor(() => expect(setDirectPathToChild).toHaveBeenCalledTimes(2));
    expect(setDirectPathToChild).toHaveBeenLastCalledWith([TIME_FILTER]);
  } finally {
    title.remove();
  }
});

test.each(['ON_REFRESH', 'SET_ACTIVE_TAB', 'SET_ACTIVE_TABS'])(
  'after %s (Refresh dashboard, auto-refresh, a tab), a server rejection does not move focus',
  async type => {
    prepareLimits();
    const title = addFilterTitle();
    try {
      const store = renderLimitsDashboard(
        limitsDashboardState({ value: 'Last week' }),
      );
      await loadSettled();

      act(() => {
        store.dispatch(setTimeRangeUserApply({ [TIME_FILTER]: 'Last week' }));
        store.dispatch({ type });
      });
      rejectAfterApply(store, 'Last week');

      expect(await screen.findByText(/This link opened/)).toBeInTheDocument();
      await pause();
      expect(setDirectPathToChild).not.toHaveBeenCalled();
    } finally {
      title.remove();
    }
  },
);

test("once the Apply's charts settle with no problem, a later rejection does not move focus", async () => {
  prepareLimits();
  const title = addFilterTitle();
  try {
    const store = renderLimitsDashboard(
      limitsDashboardState({ value: 'Last week' }),
    );
    await loadSettled();

    act(() => {
      store.dispatch(setTimeRangeUserApply({ [TIME_FILTER]: 'Last week' }));
      store.dispatch(holdChart({ signature: '{}', status: 'checking' }));
      store.dispatch(holdChart({ signature: '{}', status: 'queried' }));
    });
    await waitFor(() =>
      expect(store.getState().timeRangeLimits.userApply).toBeUndefined(),
    );
    act(() => {
      store.dispatch(holdChart(markedHold('Last week')));
    });

    expect(await screen.findByText(/This link opened/)).toBeInTheDocument();
    await pause();
    expect(setDirectPathToChild).not.toHaveBeenCalled();
  } finally {
    title.remove();
  }
});

test("a rejection while the filter's check is pending moves focus only once the check answers", async () => {
  prepareLimits();
  let release!: () => void;
  const held = new Promise<void>(done => {
    release = done;
  });
  fetchMock.removeRoute('alert-time-range');
  fetchMock.get(
    'glob:*/api/v1/time_range/*',
    async ({ url }: { url: string }) => {
      const request = rison.decode(new URL(url).searchParams.get('q')!) as {
        timeRange: string;
      }[];
      if (request.some(({ timeRange }) => timeRange === 'Last year')) {
        await held;
      }
      return {
        result: request.map(({ timeRange }) => {
          const [since, until] = ALERT_SERVER[timeRange] ?? ['', ''];
          return { since, until, timeRange, shift: null };
        }),
      };
    },
    { name: 'alert-time-range' },
  );
  const title = addFilterTitle();
  try {
    const store = renderLimitsDashboard(
      limitsDashboardState({ value: 'Last week' }),
    );
    await loadSettled();

    act(() => {
      store.dispatch(setTimeRangeUserApply({ [TIME_FILTER]: 'Last year' }));
      store.dispatch(
        dataMaskActions.updateDataMask(TIME_FILTER, {
          extraFormData: { time_range: 'Last year' },
          filterState: { value: 'Last year' },
        }),
      );
    });
    rejectAfterApply(store, 'Last year');
    await pause();

    expect(setDirectPathToChild).not.toHaveBeenCalled();
    expect(store.getState().timeRangeLimits.userApply).toBeDefined();

    await act(async () => {
      release();
    });

    await waitFor(() =>
      expect(setDirectPathToChild).toHaveBeenCalledWith([TIME_FILTER]),
    );
    await pause();
    expect(setDirectPathToChild).toHaveBeenCalledTimes(1);
  } finally {
    title.remove();
  }
});

test("with the filter bar collapsed, a rejection after the user's Apply focuses the alert's first button", async () => {
  prepareLimits();
  const store = renderLimitsDashboard(
    limitsDashboardState({ value: 'Last week' }),
    { filtersOpen: false },
  );
  await loadSettled();

  act(() => {
    store.dispatch(setTimeRangeUserApply({ [TIME_FILTER]: 'Last week' }));
  });
  rejectAfterApply(store, 'Last week');

  const alert = await screen.findByTestId('time-range-limits-alert');
  await waitFor(() =>
    expect(within(alert).getAllByRole('button')[0]).toHaveFocus(),
  );
  expect(setDirectPathToChild).not.toHaveBeenCalled();
});

test('the limits-failed sentence has the id Apply filters points at', async () => {
  prepareLimits();
  renderLimitsDashboard(limitsDashboardState({ status: 'failed' }));

  expect(
    screen.getByText(
      'Time range limits could not be loaded. Queries are paused to protect the database.',
    ),
  ).toHaveAttribute('id', LIMITS_FAILED_TEXT_ID);
});

test('the limits-failed alert sentence has its id', async () => {
  prepareLimits();
  renderLimitsDashboard(limitsDashboardState());

  expect(await screen.findByText(ALERT_TEXT)).toHaveAttribute(
    'id',
    LIMITS_ALERT_TEXT_ID,
  );
});

test('Retry keeps focus: the alert stays with a loading Retry, and focus stays on Retry after another failure', async () => {
  prepareLimits();
  fetchMock.get(
    LIMITS_GET,
    () => new Promise(resolve => setTimeout(() => resolve(500), 200)),
    { name: 'alert-limits' },
  );
  renderLimitsDashboard(limitsDashboardState({ status: 'failed' }));
  const retry = screen.getByRole('button', { name: 'Retry' });
  retry.focus();

  await userEvent.click(retry);

  await waitFor(() => expect(retry).toHaveClass('ant-btn-loading'));
  expect(retry).toBeInTheDocument();
  expect(retry).toHaveFocus();
  await waitFor(() => expect(retry).not.toHaveClass('ant-btn-loading'));
  expect(retry).toBeInTheDocument();
  expect(retry).toHaveFocus();
  expect(document.activeElement).not.toBe(document.body);
  expect(fetchMock.callHistory.calls('alert-limits')).toHaveLength(1);
});

test('after a Retry that loads the limits, focus goes to the first time range filter when the bar is open', async () => {
  prepareLimits();
  fetchMock.get(
    LIMITS_GET,
    {
      result: {
        global: NO_RULES,
        dashboard: SPAN_90_DAYS,
        datasets: [],
        timezone: 'UTC',
      },
    },
    { name: 'alert-limits' },
  );
  const title = addFilterTitle();
  try {
    renderLimitsDashboard(
      limitsDashboardState({ status: 'failed', value: 'Last week' }),
    );
    const retry = screen.getByRole('button', { name: 'Retry' });
    retry.focus();
    await userEvent.click(retry);

    await waitFor(() =>
      expect(setDirectPathToChild).toHaveBeenCalledWith([TIME_FILTER]),
    );
    expect(setDirectPathToChild).toHaveBeenCalledTimes(1);
  } finally {
    title.remove();
  }
});

test('a value emptied after load (a dashboard settings save) gets no link sentence; a held chart keeps its own', async () => {
  prepareLimits();
  const store = renderLimitsDashboard(
    limitsDashboardState({ value: 'Last week' }),
  );
  await loadSettled();

  act(() => {
    store.dispatch(
      dataMaskActions.updateDataMask(TIME_FILTER, {
        extraFormData: {},
        filterState: { value: undefined },
      }),
    );
  });
  await waitFor(() =>
    expect(
      fetchMock.callHistory
        .calls('alert-time-range')
        .some(({ url }) =>
          new URL(url).searchParams.get('q')!.includes('No filter'),
        ),
    ).toBe(true),
  );
  await pause();
  expect(screen.queryByText(/This link opened/)).not.toBeInTheDocument();

  const unbounded = {
    signature: '{}',
    status: 'unbounded',
    failures: [
      {
        ...SPAN_FAILURE,
        reason: 'UNBOUNDED_RANGE',
        rule: null,
        limit: null,
        range: { ...SPAN_FAILURE.range, since: null, until: null },
      },
    ],
    attribution: { filterId: null, filterValue: null, chart: true },
  };
  act(() => {
    store.dispatch(holdChart(unbounded));
  });

  expect(
    await screen.findByText(
      'This chart requires a bounded time range. Ask a dashboard editor to add or scope a time range filter.',
    ),
  ).toBeInTheDocument();
  expect(screen.queryByText(/This link opened/)).not.toBeInTheDocument();
  expect(store.getState().timeRangeLimits.charts[5].status).toBe('unbounded');
});

test("a failed range lookup for the filter's value raises no dashboard alert while the charts run", async () => {
  prepareLimits();
  fetchMock.removeRoute('alert-time-range');
  fetchMock.get('glob:*/api/v1/time_range/*', 503, {
    name: 'alert-time-range',
  });
  renderLimitsDashboard(
    limitsDashboardState({
      value: 'Last week',
      holds: { 5: { signature: '{}', status: 'queried' } },
    }),
  );
  await loadSettled();

  expect(
    screen.queryByText(
      'Time range limits could not be loaded. Queries are paused to protect the database.',
    ),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByTestId('time-range-limits-alert'),
  ).not.toBeInTheDocument();
});

test('a value cleared after the loaded value was changed gets no link sentence, even when it matches the loaded value', async () => {
  prepareLimits();
  const store = renderLimitsDashboard(
    limitsDashboardState({ value: 'No filter' }),
  );
  expect(
    await screen.findByText(
      'This link opened a time range with no start or end date.',
    ),
  ).toBeInTheDocument();

  act(() => {
    store.dispatch(
      dataMaskActions.updateDataMask(TIME_FILTER, {
        extraFormData: { time_range: 'Last week' },
        filterState: { value: 'Last week' },
      }),
    );
  });
  await waitFor(() =>
    expect(screen.queryByText(/This link opened/)).not.toBeInTheDocument(),
  );

  act(() => {
    store.dispatch(
      dashboardInfoChanged({
        metadata: store.getState().dashboardInfo.metadata,
      }),
    );
    store.dispatch(
      dataMaskActions.updateDataMask(TIME_FILTER, {
        extraFormData: {},
        filterState: { value: undefined },
      }),
    );
  });
  await pause();
  expect(screen.queryByText(/This link opened/)).not.toBeInTheDocument();
});

// What `hydrateWithState` dispatches when Try again loads the saved state. The
// mock of the hydrate module above keeps the data mask reducer from seeing
// HYDRATE_DASHBOARD in this file, so its result is set in the same batch.
function hydrateSavedState(
  store: ReturnType<typeof renderLimitsDashboard>,
  value: string,
) {
  const state = store.getState();
  act(() => {
    store.dispatch({
      type: 'HYDRATE_DASHBOARD',
      data: {
        dashboardInfo: state.dashboardInfo,
        dashboardState: state.dashboardState,
        dashboardLayout: state.dashboardLayout,
        dashboardFilters: state.dashboardFilters,
        nativeFilters: state.nativeFilters,
        sliceEntities: state.sliceEntities,
        charts: state.charts,
        dataMask: {},
      },
    });
    store.dispatch(
      dataMaskActions.updateDataMask(TIME_FILTER, {
        extraFormData: { time_range: value },
        filterState: { value },
      }),
    );
  });
}

test.each(['permalink', 'native_filters_key'])(
  'Try again on a %s that failed at load: the saved range it restores gets the link sentence',
  async () => {
    prepareLimits();
    const store = renderLimitsDashboard(
      limitsDashboardState({ value: 'Last week' }),
    );
    await loadSettled();
    expect(screen.queryByText(ALERT_TEXT)).not.toBeInTheDocument();

    hydrateSavedState(store, 'Last year');

    expect(store.getState().dataMask[TIME_FILTER].filterState?.value).toBe(
      'Last year',
    );
    expect(await screen.findByText(ALERT_TEXT)).toBeInTheDocument();
  },
);
