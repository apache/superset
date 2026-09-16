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
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { AnyAction, Store } from 'redux';
import fetchMock from 'fetch-mock';
import type { DataMaskStateWithId, JsonObject } from '@superset-ui/core';
import {
  hydrateDashboard,
  type HydrateChartData,
  type HydrateDashboardData,
} from 'src/dashboard/actions/hydrate';
import { CLEAR_DATA_MASK_STATE } from 'src/dataMask/actions';
import { CHART_TYPE, MARKDOWN_TYPE } from 'src/dashboard/util/componentTypes';
import {
  fetchDashboardHydrationData,
  fetchDashboardTheme,
  fetchVersionSnapshot,
} from './api';
import type { DashboardVersionSnapshot, VersionHistoryState } from './types';
import {
  resolveSnapshotCharts,
  useDashboardVersionPreview,
} from './useDashboardVersionPreview';

jest.mock('src/dashboard/actions/hydrate', () => ({
  hydrateDashboard: jest.fn(),
}));
const mockAddDangerToast = jest.fn();
jest.mock('src/components/MessageToasts/withToasts', () => ({
  // Stable across renders, as the real hook is: a fresh fn per render would
  // change the main effect's dependency identity and re-run the apply on
  // every store update, masking staleness bugs these tests exist to catch.
  useToasts: () => ({ addDangerToast: mockAddDangerToast }),
}));
jest.mock('./api', () => ({
  ...jest.requireActual('./api'),
  fetchDashboardHydrationData: jest.fn(),
  fetchDashboardTheme: jest.fn(),
  fetchVersionSnapshot: jest.fn(),
}));

const liveChart = (sliceId: number, name: string): HydrateChartData => ({
  slice_id: sliceId,
  slice_url: `/explore/?slice_id=${sliceId}`,
  slice_name: name,
  form_data: { slice_id: sliceId, viz_type: 'table' },
  description: '',
  description_markeddown: '',
  editors: [],
  modified: '',
  changed_on: '2025-12-05T17:18:00',
});

const chartSlot = (key: string, chartId: number): JsonObject => ({
  [key]: {
    type: CHART_TYPE,
    id: key,
    children: [],
    meta: { chartId, uuid: `uuid-${chartId}`, width: 4, height: 50 },
  },
});

afterEach(() => {
  jest.clearAllMocks();
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

test('resolveSnapshotCharts passes no charts when the snapshot has no layout', async () => {
  const result = await resolveSnapshotCharts([liveChart(1, 'Live')], null);
  expect(result).toEqual({ charts: [], positionData: null });
});

test('resolveSnapshotCharts keeps only charts the snapshot layout references', async () => {
  const layout = { ...chartSlot('CHART-a', 1) };
  const inSnapshot = liveChart(1, 'In snapshot');
  const addedLater = liveChart(2, 'Added after snapshot');

  const { charts, positionData } = await resolveSnapshotCharts(
    [inSnapshot, addedLater],
    layout,
  );

  // Charts added to the dashboard after the snapshot must be dropped,
  // otherwise hydrate appends them to the previewed layout as new rows.
  expect(charts).toEqual([inSnapshot]);
  expect(positionData).toBe(layout);
});

test('resolveSnapshotCharts fetches charts removed from the dashboard since the snapshot', async () => {
  fetchMock.get('glob:*/api/v1/explore/?slice_id=9', {
    result: {
      slice: { slice_name: 'Removed chart', description: 'desc' },
      form_data: { viz_type: 'big_number' },
    },
  });
  const layout = { ...chartSlot('CHART-a', 1), ...chartSlot('CHART-b', 9) };

  const { charts, positionData } = await resolveSnapshotCharts(
    [liveChart(1, 'Live')],
    layout,
  );

  expect(charts).toHaveLength(2);
  const fetched = charts.find(chart => chart.slice_id === 9);
  expect(fetched).toMatchObject({
    slice_id: 9,
    slice_name: 'Removed chart',
    form_data: { viz_type: 'big_number', slice_id: 9 },
  });
  expect(positionData).toBe(layout);
});

test('resolveSnapshotCharts bounds how many chart lookups it runs at once', async () => {
  // One request per chart with no cap would open as many connections as the
  // snapshot has charts the dashboard no longer holds.
  const missingCount = 20;
  let inFlight = 0;
  let peakInFlight = 0;
  const release: Array<() => void> = [];
  const layout: JsonObject = {};

  for (let i = 0; i < missingCount; i += 1) {
    const sliceId = 100 + i;
    Object.assign(layout, chartSlot(`CHART-${sliceId}`, sliceId));
    fetchMock.get(`glob:*/api/v1/explore/?slice_id=${sliceId}`, async () => {
      inFlight += 1;
      peakInFlight = Math.max(peakInFlight, inFlight);
      await new Promise<void>(resolve => {
        release.push(resolve);
      });
      inFlight -= 1;
      return {
        result: { slice: { slice_name: `Chart ${sliceId}` }, form_data: {} },
      };
    });
  }

  const resolution = resolveSnapshotCharts([], layout);
  // Drain in waves until every request has been served.
  for (let drained = 0; drained < missingCount; drained += 1) {
    // eslint-disable-next-line no-await-in-loop
    await waitFor(() => expect(release.length).toBeGreaterThan(drained));
    release[drained]();
  }
  const { charts } = await resolution;

  expect(charts).toHaveLength(missingCount);
  expect(peakInFlight).toBeLessThanOrEqual(6);
});

test('resolveSnapshotCharts swaps unreachable charts for a markdown placeholder', async () => {
  fetchMock.get('glob:*/api/v1/explore/?slice_id=9', 404);
  const layout = { ...chartSlot('CHART-a', 1), ...chartSlot('CHART-b', 9) };

  const { charts, positionData } = await resolveSnapshotCharts(
    [liveChart(1, 'Live')],
    layout,
  );

  expect(charts.map(chart => chart.slice_id)).toEqual([1]);
  expect((positionData as JsonObject)['CHART-a'].type).toBe(CHART_TYPE);
  const placeholder = (positionData as JsonObject)['CHART-b'];
  expect(placeholder.type).toBe(MARKDOWN_TYPE);
  expect(placeholder.meta).toEqual({
    width: 4,
    height: 50,
    code: 'This chart no longer exists.',
  });
});

const HYDRATE_TEST = 'HYDRATE_TEST_ACTION';

const mockedHydrateDashboard = hydrateDashboard as unknown as jest.Mock;
const mockedFetchHydration = fetchDashboardHydrationData as jest.MockedFunction<
  typeof fetchDashboardHydrationData
>;
const mockedFetchSnapshot = fetchVersionSnapshot as unknown as jest.Mock<
  Promise<DashboardVersionSnapshot>
>;
const mockedFetchTheme = fetchDashboardTheme as jest.MockedFunction<
  typeof fetchDashboardTheme
>;

const liveTheme = {
  id: 9,
  theme_name: 'Live theme',
  json_data: '{}',
};

const liveDashboard = {
  id: 6,
  dashboard_title: 'Live dashboard',
  description: 'Live description',
  slug: 'live-slug',
  certified_by: 'Live certifier',
  certification_details: 'Live details',
  published: true,
  theme: liveTheme,
  metadata: {},
  position_data: null,
} as unknown as HydrateDashboardData;

const snapshot = {
  dashboard_title: 'Snapshot title',
  position_json: null,
  json_metadata: '{}',
  css: '',
  description: null,
  slug: null,
  certified_by: null,
  certification_details: null,
  published: false,
  theme_id: null,
  uuid: 'dash-uuid',
} as unknown as DashboardVersionSnapshot;

const liveMask = {
  'NATIVE_FILTER-abc': {
    id: 'NATIVE_FILTER-abc',
    filterState: { value: ['girl'] },
    extraFormData: { filters: [{ col: 'gender', op: 'IN', val: ['girl'] }] },
    ownState: {},
  },
} as unknown as DataMaskStateWithId;

const versionHistoryState = (
  overrides: Partial<VersionHistoryState> = {},
): VersionHistoryState => ({
  isPanelOpen: true,
  entityType: 'dashboard',
  include: 'all',
  preview: null,
  isPreviewApplying: false,
  sessionLog: [],
  restoreCount: 0,
  lastRestoredEntityUuid: null,
  ...overrides,
});

const previewOf = (versionUuid: string) => ({
  entityUuid: 'dash-uuid',
  versionUuid,
  transactionId: 1,
  headline: 'A save',
  issuedAt: '2025-12-08T17:18:00',
});

interface TestState {
  versionHistory: VersionHistoryState;
  dashboardInfo: { id: number; last_modified_time?: number };
  dataMask: DataMaskStateWithId;
}

/** Minimal recording store: dispatched actions are captured, never reduced,
 * so tests assert exactly what the hook dispatches and control state
 * transitions explicitly via setState. */
function makeTestStore(initial: TestState) {
  let state = initial;
  const actions: AnyAction[] = [];
  const listeners = new Set<() => void>();
  return {
    actions,
    getState: () => state,
    setState(partial: Partial<TestState>) {
      state = { ...state, ...partial };
      listeners.forEach(listener => listener());
    },
    dispatch(action: AnyAction) {
      actions.push(action);
      return action;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
type TestStore = ReturnType<typeof makeTestStore>;

const renderPreviewHook = (store: TestStore) =>
  renderHook(() => useDashboardVersionPreview('dash-uuid'), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <Provider store={store as unknown as Store}>
        <MemoryRouter>{children}</MemoryRouter>
      </Provider>
    ),
  });

const makePreviewStore = () =>
  makeTestStore({
    versionHistory: versionHistoryState(),
    dashboardInfo: { id: 6 },
    dataMask: liveMask,
  });

const hydrateMaskArg = (call: number) =>
  mockedHydrateDashboard.mock.calls[call][0].dataMask;

beforeEach(() => {
  mockedHydrateDashboard.mockImplementation(params => ({
    type: HYDRATE_TEST,
    params,
  }));
  mockedFetchHydration.mockResolvedValue({
    dashboard: liveDashboard,
    charts: [],
  });
  mockedFetchSnapshot.mockResolvedValue(snapshot);
});

test('previewing a version resets the dataMask and hydrates with snapshot defaults', async () => {
  const store = makePreviewStore();
  renderPreviewHook(store);

  act(() => {
    store.setState({
      versionHistory: versionHistoryState({ preview: previewOf('v1') }),
    });
  });

  await waitFor(() => expect(mockedHydrateDashboard).toHaveBeenCalledTimes(1));
  // The snapshot renders with its own filter defaults, not live selections.
  expect(hydrateMaskArg(0)).toEqual({});
  const types = store.actions.map(action => action.type);
  const clearIndex = types.indexOf(CLEAR_DATA_MASK_STATE);
  expect(clearIndex).toBeGreaterThanOrEqual(0);
  expect(clearIndex).toBeLessThan(types.indexOf(HYDRATE_TEST));
});

test('previewing applies every scalar the snapshot carries, not just the title', async () => {
  // The snapshot endpoint has always projected these. Applying only title,
  // css and metadata left the live certification badge, draft/published pill
  // and description sitting over historical content.
  const store = makePreviewStore();
  renderPreviewHook(store);

  act(() => {
    store.setState({
      versionHistory: versionHistoryState({ preview: previewOf('v1') }),
    });
  });

  await waitFor(() => expect(mockedHydrateDashboard).toHaveBeenCalledTimes(1));
  expect(mockedHydrateDashboard.mock.calls[0][0].dashboard).toMatchObject({
    dashboard_title: 'Snapshot title',
    description: null,
    slug: null,
    certified_by: null,
    certification_details: null,
    published: false,
    theme: null,
  });
});

test('previewing resolves a snapshot theme the live dashboard no longer uses', async () => {
  // The version table stores theme_id, so a snapshot taken under a different
  // theme needs one lookup to render as it did.
  const snapshotTheme = { id: 4, theme_name: 'Old theme', json_data: '{}' };
  mockedFetchTheme.mockResolvedValue(snapshotTheme);
  mockedFetchSnapshot.mockResolvedValue({
    ...snapshot,
    theme_id: 4,
  } as unknown as DashboardVersionSnapshot);
  const store = makePreviewStore();
  renderPreviewHook(store);

  act(() => {
    store.setState({
      versionHistory: versionHistoryState({ preview: previewOf('v1') }),
    });
  });

  await waitFor(() => expect(mockedHydrateDashboard).toHaveBeenCalledTimes(1));
  expect(mockedFetchTheme).toHaveBeenCalledWith(4);
  expect(mockedHydrateDashboard.mock.calls[0][0].dashboard.theme).toEqual(
    snapshotTheme,
  );
});

test('a snapshot theme matching the live one costs no extra request', async () => {
  mockedFetchSnapshot.mockResolvedValue({
    ...snapshot,
    theme_id: liveTheme.id,
  } as unknown as DashboardVersionSnapshot);
  const store = makePreviewStore();
  renderPreviewHook(store);

  act(() => {
    store.setState({
      versionHistory: versionHistoryState({ preview: previewOf('v1') }),
    });
  });

  await waitFor(() => expect(mockedHydrateDashboard).toHaveBeenCalledTimes(1));
  expect(mockedFetchTheme).not.toHaveBeenCalled();
  expect(mockedHydrateDashboard.mock.calls[0][0].dashboard.theme).toEqual(
    liveTheme,
  );
});

test('a failed theme lookup keeps the preview rather than dropping it', async () => {
  mockedFetchTheme.mockRejectedValue(new Error('gone'));
  mockedFetchSnapshot.mockResolvedValue({
    ...snapshot,
    theme_id: 4,
  } as unknown as DashboardVersionSnapshot);
  const store = makePreviewStore();
  renderPreviewHook(store);

  act(() => {
    store.setState({
      versionHistory: versionHistoryState({ preview: previewOf('v1') }),
    });
  });

  await waitFor(() => expect(mockedHydrateDashboard).toHaveBeenCalledTimes(1));
  expect(mockedHydrateDashboard.mock.calls[0][0].dashboard.theme).toEqual(
    liveTheme,
  );
  expect(mockAddDangerToast).not.toHaveBeenCalled();
});

test('closing the preview restores the dataMask captured before previewing', async () => {
  const store = makePreviewStore();
  renderPreviewHook(store);

  act(() => {
    store.setState({
      versionHistory: versionHistoryState({ preview: previewOf('v1') }),
    });
  });
  await waitFor(() => expect(mockedHydrateDashboard).toHaveBeenCalledTimes(1));

  // The previewed version applied its own defaults to the store; closing
  // must restore what the user had, not what the store holds at exit time.
  act(() => {
    store.setState({ dataMask: {} });
  });
  act(() => {
    store.setState({ versionHistory: versionHistoryState() });
  });

  await waitFor(() => expect(mockedHydrateDashboard).toHaveBeenCalledTimes(2));
  expect(hydrateMaskArg(1)).toEqual(liveMask);
  const types = store.actions.map(action => action.type);
  expect(types.filter(type => type === CLEAR_DATA_MASK_STATE)).toHaveLength(2);
});

test('a save landing after exit-preview invalidates the cached live copy', async () => {
  const store = makePreviewStore();
  renderPreviewHook(store);

  // Preview v1 fetches and caches the live copy.
  act(() => {
    store.setState({
      versionHistory: versionHistoryState({ preview: previewOf('v1') }),
    });
  });
  await waitFor(() => expect(mockedHydrateDashboard).toHaveBeenCalledTimes(1));
  expect(mockedFetchHydration).toHaveBeenCalledTimes(1);

  // Exit preview rehydrates the live dashboard from the cache.
  act(() => {
    store.setState({ versionHistory: versionHistoryState() });
  });
  await waitFor(() => expect(mockedHydrateDashboard).toHaveBeenCalledTimes(2));

  // A save lands (properties/native-filter saves bump
  // dashboardInfo.last_modified_time) — the cached copy is stale.
  act(() => {
    store.setState({
      dashboardInfo: { id: 6, last_modified_time: 1765200000 },
    });
  });

  // The next preview must fetch a fresh live copy, not reuse the cache —
  // otherwise exiting it would rehydrate the pre-save state.
  act(() => {
    store.setState({
      versionHistory: versionHistoryState({ preview: previewOf('v2') }),
    });
  });
  await waitFor(() => expect(mockedHydrateDashboard).toHaveBeenCalledTimes(3));
  expect(mockedFetchHydration).toHaveBeenCalledTimes(2);
});

test('closing a pending preview prevents historical hydration', async () => {
  let resolveSnapshot: (value: DashboardVersionSnapshot) => void = () => {};
  mockedFetchSnapshot.mockReturnValue(
    new Promise(resolve => {
      resolveSnapshot = resolve;
    }),
  );
  const store = makePreviewStore();
  renderPreviewHook(store);

  act(() => {
    store.setState({
      versionHistory: versionHistoryState({ preview: previewOf('v1') }),
    });
  });
  await waitFor(() => expect(mockedFetchSnapshot).toHaveBeenCalledTimes(1));

  act(() => {
    store.setState({ versionHistory: versionHistoryState() });
  });
  await act(async () => {
    resolveSnapshot(snapshot);
  });

  expect(mockedHydrateDashboard).not.toHaveBeenCalled();
});

test('unmounting during a pending preview prevents historical hydration', async () => {
  // Hydration writes to the global store, so a request still in flight when
  // the user navigates away would apply a dashboard over the next page. The
  // fetch-id guard does not cover this: nothing supersedes the request.
  let resolveSnapshot: (value: DashboardVersionSnapshot) => void = () => {};
  mockedFetchSnapshot.mockReturnValue(
    new Promise(resolve => {
      resolveSnapshot = resolve;
    }),
  );
  const store = makePreviewStore();
  const { unmount } = renderPreviewHook(store);

  act(() => {
    store.setState({
      versionHistory: versionHistoryState({ preview: previewOf('v1') }),
    });
  });
  await waitFor(() => expect(mockedFetchSnapshot).toHaveBeenCalledTimes(1));

  unmount();
  await act(async () => {
    resolveSnapshot(snapshot);
  });

  expect(mockedHydrateDashboard).not.toHaveBeenCalled();
  // The global versionHistory slice must not be touched either: dispatching
  // completion after unmount would mutate the next page's preview state.
  expect(
    store.actions.some(action => action.type === 'VERSION_PREVIEW_APPLIED'),
  ).toBe(false);
});

test('switching previewed versions keeps the original live dataMask for exit', async () => {
  const store = makePreviewStore();
  renderPreviewHook(store);

  act(() => {
    store.setState({
      versionHistory: versionHistoryState({ preview: previewOf('v1') }),
    });
  });
  await waitFor(() => expect(mockedHydrateDashboard).toHaveBeenCalledTimes(1));

  act(() => {
    store.setState({ dataMask: {} });
  });
  act(() => {
    store.setState({
      versionHistory: versionHistoryState({ preview: previewOf('v2') }),
    });
  });
  await waitFor(() => expect(mockedHydrateDashboard).toHaveBeenCalledTimes(2));
  expect(hydrateMaskArg(1)).toEqual({});

  act(() => {
    store.setState({ versionHistory: versionHistoryState() });
  });
  await waitFor(() => expect(mockedHydrateDashboard).toHaveBeenCalledTimes(3));
  expect(hydrateMaskArg(2)).toEqual(liveMask);
});

test('a save landing while a preview is applying refreshes the cached live copy', async () => {
  // A save confirmed just before the preview opened can resolve while the
  // apply is still fetching. The copy in hand then predates the save, and
  // caching it would let exit-preview resurrect pre-save state.
  let resolveSnapshot: (value: DashboardVersionSnapshot) => void = () => {};
  mockedFetchSnapshot.mockReturnValue(
    new Promise(resolve => {
      resolveSnapshot = resolve;
    }),
  );
  const store = makePreviewStore();
  renderPreviewHook(store);

  act(() => {
    store.setState({
      versionHistory: versionHistoryState({ preview: previewOf('v1') }),
    });
  });
  await waitFor(() => expect(mockedFetchHydration).toHaveBeenCalledTimes(1));

  // The save signal moves mid-apply.
  act(() => {
    store.setState({ dashboardInfo: { id: 6, last_modified_time: 999 } });
  });
  await act(async () => {
    resolveSnapshot(snapshot);
  });

  await waitFor(() => expect(mockedFetchHydration).toHaveBeenCalledTimes(2));
});

test("another entity's restore does not rehydrate this dashboard", async () => {
  // The store outlives SPA navigation: a restore confirmed on page A can
  // resolve after the user is already on page B. Reacting to it here would
  // clear B's filters and refetch every chart for a change B never had.
  const store = makePreviewStore();
  renderPreviewHook(store);

  act(() => {
    store.setState({
      versionHistory: versionHistoryState({
        restoreCount: 1,
        lastRestoredEntityUuid: 'some-other-dashboard-uuid',
      }),
    });
  });

  // Give any (wrong) fetch/hydrate a chance to happen before asserting.
  await act(async () => {
    await Promise.resolve();
  });
  expect(mockedFetchHydration).not.toHaveBeenCalled();
  expect(mockedHydrateDashboard).not.toHaveBeenCalled();
});

test('reloading after a restore hydrates with no carried-over dataMask', async () => {
  const store = makePreviewStore();
  renderPreviewHook(store);

  act(() => {
    store.setState({
      versionHistory: versionHistoryState({
        restoreCount: 1,
        lastRestoredEntityUuid: 'dash-uuid',
      }),
    });
  });

  await waitFor(() => expect(mockedHydrateDashboard).toHaveBeenCalledTimes(1));
  // A restored version behaves like a fresh page load.
  expect(hydrateMaskArg(0)).toEqual({});
});

test('a save landing during the theme fetch does not strand the preview', async () => {
  // The save-signal effect clears liveDataRef whenever no preview is applied
  // yet. The theme lookup awaits *after* the cache is committed but *before*
  // appliedVersionRef is set, so a save landing in that window nulls the
  // cache while the preview goes on to apply -- and exit-preview, which only
  // rehydrates `if (liveData)`, then silently leaves historical content on
  // screen with the banner gone.
  let resolveTheme: (value: {
    id: number;
    theme_name: string;
    json_data: string;
  }) => void = () => {};
  mockedFetchTheme.mockReturnValue(
    new Promise(resolve => {
      resolveTheme = resolve;
    }) as ReturnType<typeof fetchDashboardTheme>,
  );
  mockedFetchSnapshot.mockResolvedValue({
    ...snapshot,
    theme_id: 4,
  } as unknown as DashboardVersionSnapshot);
  const store = makePreviewStore();
  renderPreviewHook(store);

  act(() => {
    store.setState({
      versionHistory: versionHistoryState({ preview: previewOf('v1') }),
    });
  });
  await waitFor(() => expect(mockedFetchTheme).toHaveBeenCalledTimes(1));

  // A save lands while the theme request is in flight.
  act(() => {
    store.setState({ dashboardInfo: { id: 6, last_modified_time: 999 } });
  });
  await act(async () => {
    resolveTheme({ id: 4, theme_name: 'Old theme', json_data: '{}' });
  });
  await waitFor(() => expect(mockedHydrateDashboard).toHaveBeenCalledTimes(1));

  // Close the preview: the live dashboard must come back.
  act(() => {
    store.setState({ versionHistory: versionHistoryState({ preview: null }) });
  });
  await waitFor(() => expect(mockedHydrateDashboard).toHaveBeenCalledTimes(2));
});
