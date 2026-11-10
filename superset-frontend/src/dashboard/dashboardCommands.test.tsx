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
import { act, renderHook } from '@testing-library/react';
import type { AnyAction, Store } from 'redux';
import type { DataMaskStateWithId, JsonObject } from '@superset-ui/core';
import { logging } from '@apache-superset/core/utils';
import { commands, resetContributions } from 'src/core/commands';
import {
  hydrateDashboard,
  type HydrateChartData,
  type HydrateDashboardData,
} from 'src/dashboard/actions/hydrate';
import { CLEAR_DATA_MASK_STATE } from 'src/dataMask/actions';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
import {
  fetchDashboardHydrationData,
  fetchDashboardTheme,
} from 'src/features/versionHistory/api';
import {
  SHOW_HELD_VERSION_COMMAND,
  useDashboardCommands,
} from './dashboardCommands';

jest.mock('src/dashboard/actions/hydrate', () => ({
  hydrateDashboard: jest.fn(),
}));
jest.mock('src/features/versionHistory/api', () => ({
  ...jest.requireActual('src/features/versionHistory/api'),
  fetchDashboardHydrationData: jest.fn(),
  fetchDashboardTheme: jest.fn(),
}));

const mockedHydrate = hydrateDashboard as jest.MockedFunction<
  typeof hydrateDashboard
>;
const mockedFetchLive = fetchDashboardHydrationData as jest.MockedFunction<
  typeof fetchDashboardHydrationData
>;
const mockedFetchTheme = fetchDashboardTheme as jest.MockedFunction<
  typeof fetchDashboardTheme
>;
const HYDRATE_TEST = 'HYDRATE_TEST';

const chart = (sliceId: number): HydrateChartData => ({
  slice_id: sliceId,
  slice_url: `/explore/?slice_id=${sliceId}`,
  slice_name: `Chart ${sliceId}`,
  form_data: { slice_id: sliceId, viz_type: 'table' },
  description: '',
  description_markeddown: '',
  editors: [],
  modified: '',
  changed_on: '2025-12-05T17:18:00',
});

const slot = (key: string, chartId: number): JsonObject => ({
  [key]: {
    type: CHART_TYPE,
    id: key,
    children: [],
    meta: { chartId, uuid: `uuid-${chartId}`, width: 4, height: 50 },
  },
});

const liveLayout = { ...slot('CHART-live', 1) };
const heldLayout = { ...slot('CHART-held', 2) };

const liveDashboard = {
  id: 6,
  dashboard_title: 'Live title',
  css: '',
  slug: null,
  published: true,
  theme: { id: 1, theme_name: 'Live theme' },
  metadata: { color_scheme: 'live' },
  position_data: liveLayout,
  owners: [{ id: 1, first_name: 'A', last_name: 'B' }],
} as unknown as HydrateDashboardData;

const selections = {
  'NATIVE_FILTER-abc': {
    id: 'NATIVE_FILTER-abc',
    filterState: { value: ['girl'] },
    extraFormData: { filters: [{ col: 'gender', op: 'IN', val: ['girl'] }] },
    ownState: {},
  },
} as unknown as DataMaskStateWithId;

interface TestState {
  dashboardInfo: { id?: number };
  dashboardState: {
    editMode?: boolean;
    hasUnsavedChanges?: boolean;
    dashboardIsSaving?: boolean;
  };
  dataMask: DataMaskStateWithId;
  versionHistory: { preview: unknown };
}

/** Records what is dispatched and never reduces it, so a test asserts
 * exactly what the command did and moves the state itself. */
function makeStore(overrides: Partial<TestState> = {}) {
  let state: TestState = {
    dashboardInfo: { id: 6 },
    dashboardState: { editMode: false },
    dataMask: selections,
    versionHistory: { preview: null },
    ...overrides,
  };
  const actions: AnyAction[] = [];
  return {
    actions,
    getState: () => state,
    setState(partial: Partial<TestState>) {
      state = { ...state, ...partial };
    },
    dispatch(action: AnyAction) {
      actions.push(action);
      return action;
    },
    subscribe: () => () => {},
  };
}
type TestStore = ReturnType<typeof makeStore>;

const mount = (store: TestStore) =>
  renderHook(() => useDashboardCommands(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <Provider store={store as unknown as Store}>
        <MemoryRouter>{children}</MemoryRouter>
      </Provider>
    ),
  });

const show = (...args: unknown[]) =>
  commands.executeCommand<boolean>(SHOW_HELD_VERSION_COMMAND, ...args);

const heldBody = {
  dashboard_title: 'Held title',
  position_json: JSON.stringify(heldLayout),
};

beforeEach(() => {
  mockedHydrate.mockImplementation(
    params => ({ type: HYDRATE_TEST, params }) as never,
  );
  mockedFetchLive.mockResolvedValue({
    dashboard: liveDashboard,
    charts: [chart(1), chart(2)],
  });
});

afterEach(() => {
  jest.clearAllMocks();
  resetContributions();
});

const hydrations = (store: TestStore) =>
  store.actions.filter(action => action.type === HYDRATE_TEST);

test('the command exists while a dashboard is mounted and goes with it', () => {
  const store = makeStore();
  const { unmount, rerender } = mount(store);
  expect(commands.getCommand(SHOW_HELD_VERSION_COMMAND)).toBeDefined();

  const warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});
  rerender();
  // `registerCommand` warns when it overwrites; a re-render must not.
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();

  unmount();
  expect(commands.getCommand(SHOW_HELD_VERSION_COMMAND)).toBeUndefined();
});

test('showing a held version re-hydrates the page from the held layout', async () => {
  const store = makeStore();
  mount(store);

  await expect(show(heldBody)).resolves.toBe(true);

  expect(hydrations(store)).toHaveLength(1);
  const [[params]] = mockedHydrate.mock.calls;
  expect(params.dashboard.dashboard_title).toBe('Held title');
  expect(params.dashboard.position_data).toEqual(heldLayout);
  // Fields the body did not carry stay as the live dashboard has them.
  expect(params.dashboard.theme).toEqual(liveDashboard.theme);
  expect(params.dashboard.owners).toEqual(liveDashboard.owners);
  // Only the charts the held layout names, not the live layout's.
  expect(params.charts.map(c => c.slice_id)).toEqual([2]);
});

test('the reset of the dataMask comes before the hydrate that reads it', async () => {
  const store = makeStore();
  mount(store);
  await show(heldBody);

  expect(store.actions.map(action => action.type)).toEqual([
    CLEAR_DATA_MASK_STATE,
    HYDRATE_TEST,
  ]);
});

test('the reader keeps their filter selections on the way in', async () => {
  const store = makeStore();
  mount(store);
  await show(heldBody);

  expect(mockedHydrate.mock.calls[0][0].dataMask).toBe(selections);
});

test('a layout carried only inside json_metadata still moves the grid', async () => {
  const store = makeStore();
  mount(store);

  await show({
    json_metadata: JSON.stringify({ positions: heldLayout, color_scheme: 'x' }),
  });

  const [[{ dashboard }]] = mockedHydrate.mock.calls;
  expect(dashboard.position_data).toEqual(heldLayout);
  expect(dashboard.metadata).toMatchObject({ color_scheme: 'x' });
});

test('position_json wins over json_metadata.positions', async () => {
  const store = makeStore();
  mount(store);

  await show({
    json_metadata: JSON.stringify({ positions: liveLayout }),
    position_json: JSON.stringify(heldLayout),
  });

  expect(mockedHydrate.mock.calls[0][0].dashboard.position_data).toEqual(
    heldLayout,
  );
});

test('a held theme is resolved to the theme object hydration expects', async () => {
  mockedFetchTheme.mockResolvedValue({
    id: 9,
    theme_name: 'Held theme',
  } as never);
  const store = makeStore();
  mount(store);

  await show({ theme_id: 9 });

  expect(mockedHydrate.mock.calls[0][0].dashboard.theme).toMatchObject({
    id: 9,
  });
});

test('returning to live puts the cached live dashboard back with the selections from entry', async () => {
  const store = makeStore();
  mount(store);
  await show(heldBody);

  // The reader changes a filter while the held version is up.
  store.setState({ dataMask: {} as DataMaskStateWithId });
  store.actions.length = 0;
  mockedHydrate.mockClear();

  await expect(show(null)).resolves.toBe(true);

  expect(mockedFetchLive).toHaveBeenCalledTimes(1);
  const [[params]] = mockedHydrate.mock.calls;
  expect(params.dashboard).toBe(liveDashboard);
  expect(params.charts.map(c => c.slice_id)).toEqual([1, 2]);
  expect(params.dataMask).toBe(selections);
  expect(store.actions.map(action => action.type)).toEqual([
    CLEAR_DATA_MASK_STATE,
    HYDRATE_TEST,
  ]);
});

test('going back to live twice only does it once', async () => {
  const store = makeStore();
  mount(store);
  await show(heldBody);
  await show(null);
  store.actions.length = 0;

  await expect(show(null)).resolves.toBe(true);
  expect(store.actions).toEqual([]);
});

test('switching from one held version to another keeps the first live copy', async () => {
  const store = makeStore();
  mount(store);
  await show(heldBody);
  store.setState({ dataMask: {} as DataMaskStateWithId });
  await show({ dashboard_title: 'Another' });

  expect(mockedFetchLive).toHaveBeenCalledTimes(1);
  // Carried across: the reader's current selections, not the entry ones.
  expect(mockedHydrate.mock.calls[1][0].dataMask).toEqual({});

  mockedHydrate.mockClear();
  await show(null);
  expect(mockedHydrate.mock.calls[0][0].dashboard).toBe(liveDashboard);
  expect(mockedHydrate.mock.calls[0][0].dataMask).toBe(selections);
});

test('asking for nothing when nothing is held does nothing', async () => {
  const store = makeStore();
  mount(store);

  await expect(show()).resolves.toBe(true);
  await expect(show(null)).resolves.toBe(true);
  await expect(show({})).resolves.toBe(true);

  expect(store.actions).toEqual([]);
  expect(mockedFetchLive).not.toHaveBeenCalled();
});

test.each([
  ['no dashboard has loaded', { dashboardInfo: {} }],
  [
    'a version from the history is on screen',
    { versionHistory: { preview: { versionUuid: 'v1' } } },
  ],
  [
    'there are unsaved edits',
    { dashboardState: { editMode: true, hasUnsavedChanges: true } },
  ],
  ['a save is in flight', { dashboardState: { dashboardIsSaving: true } }],
])('it leaves the page alone when %s', async (_name, overrides) => {
  const store = makeStore(overrides as Partial<TestState>);
  mount(store);

  await expect(show(heldBody)).resolves.toBe(false);

  expect(store.actions).toEqual([]);
});

test.each([
  ['changes nothing that is drawn', { owners: [1, 2] }],
  ['carries a layout that is not JSON', { position_json: '{nope' }],
  ['carries metadata that is not JSON', { json_metadata: '{nope' }],
])('a held body that %s is not drawn', async (_name, body) => {
  const store = makeStore();
  mount(store);

  await expect(show(body)).resolves.toBe(false);

  expect(store.actions).toEqual([]);
});

test('a failed request rejects and leaves the page as it was', async () => {
  mockedFetchLive.mockRejectedValue(new Error('offline'));
  const store = makeStore();
  mount(store);

  await expect(show(heldBody)).rejects.toThrow('offline');

  expect(store.actions).toEqual([]);
  // And live is still what is on screen, so asking for it is a no-op.
  await expect(show(null)).resolves.toBe(true);
  expect(store.actions).toEqual([]);
});

test('an earlier request that resolves after a later one does not hydrate', async () => {
  let release: (data: never) => void = () => {};
  mockedFetchLive.mockImplementationOnce(
    () => new Promise(resolve => (release = resolve as never)),
  );
  const store = makeStore();
  mount(store);

  const first = show({ dashboard_title: 'First' });
  const second = show({ dashboard_title: 'Second' });
  await expect(second).resolves.toBe(true);
  await act(async () => {
    release({ dashboard: liveDashboard, charts: [chart(1)] } as never);
  });
  await expect(first).resolves.toBe(false);

  expect(hydrations(store)).toHaveLength(1);
  expect(mockedHydrate.mock.calls[0][0].dashboard.dashboard_title).toBe(
    'Second',
  );
});

test('asking for live while a held version is loading cancels it', async () => {
  let release: (data: never) => void = () => {};
  mockedFetchLive.mockImplementationOnce(
    () => new Promise(resolve => (release = resolve as never)),
  );
  const store = makeStore();
  mount(store);

  const pending = show(heldBody);
  await expect(show(null)).resolves.toBe(true);
  await act(async () => {
    release({ dashboard: liveDashboard, charts: [chart(1)] } as never);
  });

  await expect(pending).resolves.toBe(false);
  expect(store.actions).toEqual([]);
});

test('a request still in flight when the page goes does not hydrate', async () => {
  let release: (data: never) => void = () => {};
  mockedFetchLive.mockImplementationOnce(
    () => new Promise(resolve => (release = resolve as never)),
  );
  const store = makeStore();
  const { unmount } = mount(store);

  const pending = show(heldBody);
  unmount();
  await act(async () => {
    release({ dashboard: liveDashboard, charts: [chart(1)] } as never);
  });

  await expect(pending).resolves.toBe(false);
  expect(store.actions).toEqual([]);
});

test('a page that went away is not re-hydrated with its live copy', async () => {
  const store = makeStore();
  const { unmount } = mount(store);
  await show(heldBody);
  store.actions.length = 0;

  unmount();

  expect(store.actions).toEqual([]);
});

test('a different dashboard in the store is not given the old live copy', async () => {
  const store = makeStore();
  mount(store);
  await show(heldBody);
  store.actions.length = 0;
  store.setState({ dashboardInfo: { id: 7 } });

  await expect(show(null)).resolves.toBe(true);

  expect(store.actions).toEqual([]);
});

test('edit mode is kept going in, and restored coming out', async () => {
  const store = makeStore({ dashboardState: { editMode: true } });
  mount(store);

  await show(heldBody);
  expect(mockedHydrate.mock.calls[0][0].editMode).toBe(true);

  // Hydration cleared it, as the real reducer would for a non-edit rehydrate.
  store.setState({ dashboardState: { editMode: false } });
  await show(null);
  expect(mockedHydrate.mock.calls[1][0].editMode).toBe(true);
});

test('a reader who was not editing is not put into edit mode', async () => {
  const store = makeStore();
  mount(store);

  await show(heldBody);
  await show(null);

  expect(mockedHydrate.mock.calls.map(call => call[0].editMode)).toEqual([
    false,
    false,
  ]);
});
