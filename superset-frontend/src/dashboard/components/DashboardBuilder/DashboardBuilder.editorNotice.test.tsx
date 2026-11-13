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
import DashboardBuilder from 'src/dashboard/components/DashboardBuilder/DashboardBuilder';
import useStoredSidebarWidth from 'src/components/ResizableSidebar/useStoredSidebarWidth';
import {
  fetchFaveStar,
  setActiveTab,
  setDirectPathToChild,
} from 'src/dashboard/actions/dashboardState';
import { Alert } from '@apache-superset/core/components';
import { fetchTimeRangeLimits } from 'src/dashboard/actions/timeRangeLimits';
import { DASHBOARD_GRID_ID } from 'src/dashboard/util/constants';
import { dashboardLayout as undoableDashboardLayout } from 'spec/fixtures/mockDashboardLayout';
import { storeWithState } from 'spec/fixtures/mockStore';
import mockState from 'spec/fixtures/mockState';
import * as useNativeFiltersModule from './state';

fetchMock.get('glob:*/csstemplateasyncmodelview/api/read', {});
fetchMock.put('glob:*/api/v1/dashboard/*', {});
// Add mock for logging endpoint
fetchMock.post('glob:*/log/?*', {});

// Mock useBreakpoint to return desktop breakpoints (prevents mobile rendering)
jest.mock('antd', () => mockAntdWithDesktopBreakpoint());

jest.mock('@apache-superset/core/components', () => {
  const actual = jest.requireActual('@apache-superset/core/components');
  return { ...actual, Alert: jest.fn(actual.Alert) };
});

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

const limitSpies: jest.SpyInstance[] = [];

function limitsDashboardState({
  value = 'Last year',
  status = 'loaded',
  dashboard = SPAN_90_DAYS,
  holds = {},
  global = NO_RULES,
  editorNotice = undefined,
  emptyGrid = false,
}: {
  value?: string;
  status?: string;
  dashboard?: Record<string, unknown>;
  holds?: Record<string, unknown>;
  global?: Record<string, unknown>;
  editorNotice?: { kind: string } | null;
  emptyGrid?: boolean;
} = {}) {
  return {
    ...mockState,
    dashboardLayout: emptyGrid
      ? {
          ...undoableDashboardLayout,
          present: {
            ...undoableDashboardLayout.present,
            [DASHBOARD_GRID_ID]: {
              ...undoableDashboardLayout.present[DASHBOARD_GRID_ID],
              children: [],
            },
          },
        }
      : undoableDashboardLayout,
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
              datasets: [],
              timezone: 'UTC',
              ...(editorNotice !== undefined && {
                editor_notice: editorNotice,
              }),
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

const NOTICE_PUT = 'glob:*/api/v1/time_range_limits/notice/';
const NOTICE_GLOBAL = {
  ...NO_RULES,
  max_span: { quantity: 1, time_grain: 'P1Y' },
  max_look_back: { quantity: 2, time_grain: 'P1Y' },
};
const TURNED_ON_TEXT =
  'Your admin turned on time range limits: up to 1 year, within the last 2 years.';
const TIGHTENED_TEXT =
  'Your admin changed time range limits: up to 1 year, within the last 2 years.';

const noticeState = (
  editorNotice: { kind: string } | null = { kind: 'turned_on' },
  overrides: Parameters<typeof limitsDashboardState>[0] = {},
) =>
  limitsDashboardState({
    value: 'Last week',
    dashboard: NO_RULES,
    global: NOTICE_GLOBAL,
    editorNotice,
    ...overrides,
  });

const chartHold = {
  5: {
    signature: '{}',
    status: 'invalid',
    failures: [SPAN_FAILURE],
    attribution: { filterId: null, filterValue: null, chart: true },
  },
};

function prepareNotice(status: number | object = {}) {
  prepareLimits();
  fetchMock.put(NOTICE_PUT, status, { name: 'notice-put' });
}

function withSearch(search: string, run: () => Promise<void>) {
  const before = window.location.href;
  window.history.pushState({}, '', `/superset/dashboard/1/${search}`);
  return run().finally(() => window.history.pushState({}, '', before));
}

function focusOutside() {
  const outside = document.createElement('input');
  document.body.appendChild(outside);
  outside.focus();
  return outside;
}

const follows = (first: Element, second: Element) =>
  Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  );

afterEach(() => {
  fetchMock.removeRoute('notice-put');
  (Alert as unknown as jest.Mock).mockClear();
});

test('an editor sees the turned-on notice right after the time range limits alert; neither takes focus', async () => {
  prepareNotice();
  const outside = focusOutside();
  try {
    renderLimitsDashboard(
      noticeState({ kind: 'turned_on' }, { holds: chartHold }),
    );

    const notice = await screen.findByTestId('time-range-limits-editor-notice');
    expect(notice).toHaveTextContent(TURNED_ON_TEXT);
    expect(notice).toHaveAttribute('role', 'alert');
    expect(
      within(notice).getByRole('button', { name: 'Got it' }),
    ).toBeInTheDocument();
    expect(within(notice).queryByRole('link')).toBeNull();
    const limitsAlert = await screen.findByTestId('time-range-limits-alert');
    expect(limitsAlert.nextElementSibling).toBe(notice);
    const info = (Alert as unknown as jest.Mock).mock.calls
      .map(([props]) => props)
      .filter(props => props.type === 'info')
      .at(-1);
    expect(info).toMatchObject({ closable: false, showIcon: true });
    expect(info.icon).toBeTruthy();
    expect(info.css).toBeUndefined();
    expect(info.style).toBeUndefined();
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(outside).toHaveFocus();
  } finally {
    outside.remove();
  }
});

test('the notice sits before the empty-dashboard state', async () => {
  prepareNotice();
  renderLimitsDashboard(
    noticeState({ kind: 'turned_on' }, { emptyGrid: true }),
  );

  const notice = await screen.findByTestId('time-range-limits-editor-notice');
  const empty = screen.getByText('There are no charts added to this dashboard');
  expect(follows(notice, empty)).toBe(true);
  expect(follows(notice, document.querySelector('.dashboard-content')!)).toBe(
    true,
  );
});

test('no focus move when the notice appears alone', async () => {
  prepareNotice();
  const outside = focusOutside();
  try {
    renderLimitsDashboard(noticeState());
    expect(await screen.findByText(TURNED_ON_TEXT)).toBeInTheDocument();
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(outside).toHaveFocus();
  } finally {
    outside.remove();
  }
});

test('the tightened notice has its own sentence', async () => {
  prepareNotice();
  renderLimitsDashboard(noticeState({ kind: 'tightened' }));

  expect(await screen.findByText(TIGHTENED_TEXT)).toBeInTheDocument();
  expect(screen.queryByText(TURNED_ON_TEXT)).not.toBeInTheDocument();
});

test('no notice when the payload has none', async () => {
  prepareNotice();
  renderLimitsDashboard(noticeState(null));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls('alert-time-range')).not.toHaveLength(0),
  );
  expect(
    screen.queryByTestId('time-range-limits-editor-notice'),
  ).not.toBeInTheDocument();
});

test('flag off: no notice and no PUT', async () => {
  prepareNotice();
  window.featureFlags = {};
  renderLimitsDashboard(noticeState());

  expect(
    screen.queryByTestId('time-range-limits-editor-notice'),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(TURNED_ON_TEXT)).not.toBeInTheDocument();
  expect(fetchMock.callHistory.calls('notice-put')).toHaveLength(0);
});

test.each([
  ['report mode', '?standalone=3'],
  ['standalone=1', '?standalone=1'],
  ['standalone=2', '?standalone=2'],
])('no notice in %s (reports and embedded views)', async (_name, search) => {
  prepareNotice();
  await withSearch(search, async () => {
    renderLimitsDashboard(noticeState());
    await waitFor(() =>
      expect(fetchMock.callHistory.calls('alert-time-range')).not.toHaveLength(
        0,
      ),
    );
    expect(screen.queryByText(TURNED_ON_TEXT)).not.toBeInTheDocument();
  });
});

test('"Got it" sends one PUT and hides the notice; focus goes to the first button of the time range limits alert', async () => {
  prepareNotice();
  const title = addFilterTitle();
  try {
    renderLimitsDashboard(
      noticeState(
        { kind: 'turned_on' },
        { value: 'Last year', dashboard: SPAN_90_DAYS },
      ),
      { filtersOpen: false },
    );
    const useLast = await screen.findByRole('button', {
      name: 'Use last 90 days',
    });
    const gotIt = await screen.findByRole('button', { name: 'Got it' });

    await userEvent.click(gotIt);

    expect(screen.queryByText(TURNED_ON_TEXT)).not.toBeInTheDocument();
    await waitFor(() => expect(useLast).toHaveFocus());
    await waitFor(() =>
      expect(fetchMock.callHistory.calls('notice-put')).toHaveLength(1),
    );
    expect(fetchMock.callHistory.calls('notice-put')[0].options.method).toBe(
      'put',
    );
  } finally {
    title.remove();
  }
});

test('after "Got it" with a time range limits alert without buttons, focus goes to the first focusable element of the dashboard content', async () => {
  prepareNotice();
  renderLimitsDashboard(
    noticeState({ kind: 'turned_on' }, { holds: chartHold }),
  );
  const limitsAlert = await screen.findByTestId('time-range-limits-alert');
  expect(within(limitsAlert).queryByRole('button')).toBeNull();
  const content = document.querySelector<HTMLElement>('.dashboard-content')!;
  const panel = within(content).getByRole('tabpanel');

  await userEvent.click(await screen.findByRole('button', { name: 'Got it' }));

  await waitFor(() => expect(panel).toHaveFocus());
  expect(limitsAlert).not.toContainElement(
    document.activeElement as HTMLElement,
  );
});

test('after "Got it" with no time range limits alert, focus goes to the first focusable element of the dashboard content', async () => {
  prepareNotice();
  renderLimitsDashboard(noticeState());
  const content = document.querySelector<HTMLElement>('.dashboard-content')!;
  // The grid's tab panel (tabindex 0) is the content's first focusable node.
  const panel = within(content).getByRole('tabpanel');
  expect(panel).toHaveAttribute('tabindex', '0');

  await userEvent.click(await screen.findByRole('button', { name: 'Got it' }));

  await waitFor(() => expect(panel).toHaveFocus());
  expect(screen.queryByText(TURNED_ON_TEXT)).not.toBeInTheDocument();
});

test('after "Got it" with nothing focusable in the content, focus goes to the edit button, never the page body', async () => {
  prepareNotice();
  const edit = document.createElement('button');
  edit.setAttribute('data-test', 'edit-dashboard-button');
  document.body.appendChild(edit);
  try {
    renderLimitsDashboard(noticeState());
    const content = document.querySelector('.dashboard-content')!;
    content
      .querySelectorAll('button, [href], input, select, textarea, [tabindex]')
      .forEach(node => node.remove());

    await userEvent.click(
      await screen.findByRole('button', { name: 'Got it' }),
    );

    await waitFor(() => expect(edit).toHaveFocus());
    expect(document.activeElement).not.toBe(document.body);
  } finally {
    edit.remove();
  }
});

test('a failed PUT still hides the notice for the page, also through a refetch', async () => {
  prepareNotice(500);
  fetchMock.get(
    LIMITS_GET,
    {
      result: {
        global: NOTICE_GLOBAL,
        dashboard: NO_RULES,
        datasets: [],
        timezone: 'UTC',
        editor_notice: { kind: 'turned_on' },
      },
    },
    { name: 'alert-limits' },
  );
  const store = renderLimitsDashboard(noticeState());

  await userEvent.click(await screen.findByRole('button', { name: 'Got it' }));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls('notice-put')).toHaveLength(1),
  );
  expect(screen.queryByText(TURNED_ON_TEXT)).not.toBeInTheDocument();

  await act(async () => {
    await store.dispatch(fetchTimeRangeLimits(LIMITS_DASHBOARD_ID) as never);
  });

  expect(fetchMock.callHistory.calls('alert-limits')).toHaveLength(1);
  expect(store.getState().timeRangeLimits.payload.editor_notice).toEqual({
    kind: 'turned_on',
  });
  expect(screen.queryByText(TURNED_ON_TEXT)).not.toBeInTheDocument();
  expect(fetchMock.callHistory.calls('notice-put')).toHaveLength(1);
});
