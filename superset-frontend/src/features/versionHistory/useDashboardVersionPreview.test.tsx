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
import { fetchDashboardHydrationData, fetchVersionSnapshot } from './api';
import type { DashboardVersionSnapshot, VersionHistoryState } from './types';
import {
  resolveSnapshotCharts,
  useDashboardVersionPreview,
} from './useDashboardVersionPreview';

jest.mock('src/dashboard/actions/hydrate', () => ({
  hydrateDashboard: jest.fn(),
}));
jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => ({ addDangerToast: jest.fn() }),
}));
jest.mock('./api', () => ({
  ...jest.requireActual('./api'),
  fetchDashboardHydrationData: jest.fn(),
  fetchVersionSnapshot: jest.fn(),
}));

const liveChart = (sliceId: number, name: string): HydrateChartData => ({
  slice_id: sliceId,
  slice_url: `/explore/?slice_id=${sliceId}`,
  slice_name: name,
  form_data: { slice_id: sliceId, viz_type: 'table' },
  description: '',
  description_markeddown: '',
  owners: [],
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

const liveDashboard = {
  id: 6,
  dashboard_title: 'Live dashboard',
  metadata: {},
  position_data: null,
} as unknown as HydrateDashboardData;

const snapshot = {
  dashboard_title: 'Snapshot title',
  position_json: null,
  json_metadata: '{}',
  css: '',
  slug: null,
  certified_by: null,
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
  sessionLog: [],
  restoreCount: 0,
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
  dashboardInfo: { id: number };
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

test('reloading after a restore hydrates with no carried-over dataMask', async () => {
  const store = makePreviewStore();
  renderPreviewHook(store);

  act(() => {
    store.setState({
      versionHistory: versionHistoryState({ restoreCount: 1 }),
    });
  });

  await waitFor(() => expect(mockedHydrateDashboard).toHaveBeenCalledTimes(1));
  // A restored version behaves like a fresh page load.
  expect(hydrateMaskArg(0)).toEqual({});
});
