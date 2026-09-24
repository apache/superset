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
import type { AnyAction, Store } from 'redux';
import fetchMock from 'fetch-mock';
import { DatasourceType, QueryFormData } from '@superset-ui/core';
import type { Slice } from 'src/dashboard/types';
import {
  updateSlice,
  createSlice,
  saveSliceSuccess,
} from 'src/explore/actions/saveModalActions';
import saveModalReducer from 'src/explore/reducers/saveModalReducer';
import { act, render, waitFor } from 'spec/helpers/testing-library';
import { hydrateExplore } from 'src/explore/actions/hydrateExplore';
import type { VersionHistoryState } from './types';
import { fetchExploreRehydrationData } from './api';
import { useVersionActivity } from './useVersionActivity';
import ExploreVersionHistory from './ExploreVersionHistory';

jest.mock('src/explore/exploreUtils', () => ({
  ...jest.requireActual('src/explore/exploreUtils'),
  buildV1ChartDataPayload: jest.fn(() => ({})),
}));

jest.mock('./VersionHistoryPanel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('./useVersionActions', () => ({
  useVersionActions: () => ({
    requestRestore: jest.fn(),
    openAsNew: jest.fn(),
    restoreModal: null,
  }),
}));
jest.mock('./useVersionActivity', () => ({
  useVersionActivity: jest.fn(),
}));
jest.mock('./api', () => ({
  ...jest.requireActual('./api'),
  fetchChartUuid: jest.fn(),
  fetchExploreRehydrationData: jest.fn(),
}));
jest.mock('src/explore/actions/hydrateExplore', () => ({
  hydrateExplore: jest.fn(),
}));
jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => ({ addDangerToast: jest.fn() }),
}));

const HYDRATE_EXPLORE_TEST = 'HYDRATE_EXPLORE_TEST_ACTION';

const mockedUseVersionActivity = useVersionActivity as jest.Mock;
const mockedHydrateExplore = hydrateExplore as unknown as jest.Mock;
const mockedFetchRehydration =
  fetchExploreRehydrationData as unknown as jest.Mock;
const refresh = jest.fn();

const versionHistoryState = (
  overrides: Partial<VersionHistoryState> = {},
): VersionHistoryState => ({
  isPanelOpen: true,
  entityType: 'chart',
  include: 'all',
  preview: null,
  isPreviewApplying: false,
  sessionLog: [],
  restoreCount: 0,
  lastRestoredEntityUuid: null,
  ...overrides,
});

interface TestSlice {
  slice_id: number;
  uuid: string;
  changed_on: string;
}

interface TestState {
  versionHistory: VersionHistoryState;
  explore: { slice?: TestSlice; form_data?: QueryFormData };
  saveModal?: ReturnType<typeof saveModalReducer>;
}

const slice = (changedOn: string): TestSlice => ({
  slice_id: 1,
  uuid: 'chart-uuid',
  changed_on: changedOn,
});

/** Reduce the real save response; unrelated transitions can be driven explicitly. */
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
    dispatch<T extends AnyAction>(action: T): T {
      actions.push(action);
      state = {
        ...state,
        saveModal: saveModalReducer(state.saveModal, action),
      };
      listeners.forEach(listener => listener());
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

const makeStore = () =>
  makeTestStore({
    versionHistory: versionHistoryState(),
    explore: { slice: slice('2025-12-08T17:18:00') },
  });

const renderAdapter = (store: ReturnType<typeof makeTestStore>) =>
  render(<ExploreVersionHistory />, { store: store as unknown as Store });

const activityResult = {
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
  refresh,
};

beforeEach(() => {
  mockedUseVersionActivity.mockReturnValue(activityResult);
  mockedFetchRehydration.mockResolvedValue({});
  mockedHydrateExplore.mockImplementation(payload => ({
    type: HYDRATE_EXPLORE_TEST,
    payload,
  }));
});

afterEach(() => {
  jest.clearAllMocks();
  fetchMock.clearHistory().removeRoutes();
});

test('overwrite success followed by timestamp hydration refreshes only once', () => {
  const store = makeStore();
  renderAdapter(store);
  expect(refresh).not.toHaveBeenCalled();

  act(() => {
    store.dispatch(saveSliceSuccess({ id: 1 }));
  });
  act(() => {
    store.setState({ explore: { slice: slice('2025-12-08T18:00:00') } });
  });

  expect(refresh).toHaveBeenCalledTimes(1);
  expect(mockedHydrateExplore).not.toHaveBeenCalled();
});

test('a restore refreshes exactly once even when it also moves the slice', async () => {
  const store = makeStore();
  renderAdapter(store);

  act(() => {
    store.setState({
      versionHistory: versionHistoryState({
        restoreCount: 1,
        lastRestoredEntityUuid: 'chart-uuid',
      }),
      explore: { slice: slice('2025-12-08T18:00:00') },
    });
  });

  expect(refresh).toHaveBeenCalledTimes(1);
  // The restore branch also reloads the explore page state in place.
  await waitFor(() =>
    expect(
      store.actions.some(action => action.type === HYDRATE_EXPLORE_TEST),
    ).toBe(true),
  );
  expect(mockedHydrateExplore).toHaveBeenCalledWith(
    expect.objectContaining({ saveAction: 'overwrite' }),
  );
});

test('a restore rehydration resolving after unmount is discarded', async () => {
  // hydrateExplore rewrites the whole explore store; a rehydration fetch
  // resolving after the user navigated away would overwrite the next page's
  // chart with this one's payload.
  let resolveRehydration: (value: object) => void = () => {};
  mockedFetchRehydration.mockReturnValue(
    new Promise(resolve => {
      resolveRehydration = resolve;
    }),
  );
  const store = makeStore();
  const { unmount } = renderAdapter(store);

  act(() => {
    store.setState({
      versionHistory: versionHistoryState({
        restoreCount: 1,
        lastRestoredEntityUuid: 'chart-uuid',
      }),
    });
  });
  await waitFor(() => expect(mockedFetchRehydration).toHaveBeenCalled());

  unmount();
  await act(async () => {
    resolveRehydration({});
  });

  expect(mockedHydrateExplore).not.toHaveBeenCalled();
  expect(
    store.actions.some(action => action.type === HYDRATE_EXPLORE_TEST),
  ).toBe(false);
});

test('a search keystroke mid-rehydration does not drop the restored version', async () => {
  // `refreshActivity` is `useVersionActivity`'s `refresh`, whose identity
  // moves whenever the debounced search term or the include filter does.
  // A guard bound to the effect run would cancel the in-flight rehydration
  // on that re-run and never re-issue it — the timeline would show the
  // restore while the chart still rendered its pre-restore state, with the
  // failure toast suppressed too.
  let resolveRehydration: (value: object) => void = () => {};
  mockedFetchRehydration.mockReturnValue(
    new Promise(resolve => {
      resolveRehydration = resolve;
    }),
  );
  mockedUseVersionActivity.mockImplementation(() => ({
    ...activityResult,
    // A fresh identity per render, as the real hook produces when `q` moves.
    refresh: () => refresh(),
  }));
  const store = makeStore();
  renderAdapter(store);

  act(() => {
    store.setState({
      versionHistory: versionHistoryState({
        restoreCount: 1,
        lastRestoredEntityUuid: 'chart-uuid',
      }),
    });
  });
  await waitFor(() => expect(mockedFetchRehydration).toHaveBeenCalled());

  // The debounce fires mid-flight and re-renders the panel.
  act(() => {
    store.setState({
      versionHistory: versionHistoryState({
        restoreCount: 1,
        lastRestoredEntityUuid: 'chart-uuid',
        include: 'self',
      }),
    });
  });

  await act(async () => {
    resolveRehydration({});
  });

  expect(mockedHydrateExplore).toHaveBeenCalledWith(
    expect.objectContaining({ saveAction: 'overwrite' }),
  );
  // ...and it was not re-issued to compensate.
  expect(mockedFetchRehydration).toHaveBeenCalledTimes(1);
});

test('the initial slice hydration does not trigger a refresh', () => {
  const store = makeTestStore({
    versionHistory: versionHistoryState(),
    explore: {},
  });
  renderAdapter(store);

  act(() => {
    store.setState({ explore: { slice: slice('2025-12-08T17:18:00') } });
  });

  expect(refresh).not.toHaveBeenCalled();
});

test('does not refresh when state changes leave changed_on untouched', () => {
  const store = makeStore();
  renderAdapter(store);

  act(() => {
    store.setState({ explore: { slice: slice('2025-12-08T17:18:00') } });
  });

  expect(refresh).not.toHaveBeenCalled();
});

test('a save landing mid-rehydration wins over the older restore payload', async () => {
  // The restore payload was fetched before the save committed, so hydrating
  // it would roll the chart back over the newer state. The save's own
  // in-place hydration is already correct; the stale payload is dropped.
  let resolveRehydration: (value: object) => void = () => {};
  mockedFetchRehydration.mockReturnValue(
    new Promise(resolve => {
      resolveRehydration = resolve;
    }),
  );
  const store = makeStore();
  renderAdapter(store);

  act(() => {
    store.setState({
      versionHistory: versionHistoryState({
        restoreCount: 1,
        lastRestoredEntityUuid: 'chart-uuid',
      }),
    });
  });
  await waitFor(() => expect(mockedFetchRehydration).toHaveBeenCalled());

  // An overwrite save commits while the rehydration is still in flight.
  act(() => {
    store.dispatch(saveSliceSuccess({ id: 1 }));
  });

  await act(async () => {
    resolveRehydration({});
  });

  expect(mockedHydrateExplore).not.toHaveBeenCalled();
});

const overwriteSlice: Slice = {
  slice_id: 1,
  slice_name: 'Example',
  editors: [],
  form_data: { datasource: '1__table', viz_type: 'table' },
  description: '',
  description_markdown: '',
  slice_url: '',
  viz_type: 'table',
  thumbnail_url: '',
  changed_on: 0,
  changed_on_humanized: '',
  modified: '',
  datasource_id: 1,
  datasource_type: DatasourceType.Table,
  datasource_url: '',
  datasource_name: '',
  created_by: { id: 1 },
};

const makeSaveStore = () =>
  makeTestStore({
    versionHistory: versionHistoryState(),
    explore: {
      slice: slice('2025-12-08T17:18:00'),
      form_data: overwriteSlice.form_data,
    },
  });

test('real overwrite success refreshes the open panel on every save without changed_on movement', async () => {
  fetchMock.put('glob:*/api/v1/chart/1', { id: 1, result: {} });
  const store = makeSaveStore();
  renderAdapter(store);

  for (let save = 1; save <= 2; save += 1) {
    await act(async () => {
      await updateSlice(
        overwriteSlice,
        'Example',
        [],
      )(store.dispatch, store.getState);
    });
    expect(store.getState().explore.slice?.changed_on).toBe(
      '2025-12-08T17:18:00',
    );
    expect(refresh).toHaveBeenCalledTimes(save);
  }
  expect(mockedHydrateExplore).not.toHaveBeenCalled();
});

test('a failed overwrite and a save-as result do not refresh the old chart', async () => {
  fetchMock.put('glob:*/api/v1/chart/1', 500);
  fetchMock.post('glob:*/api/v1/chart/', { id: 2, result: {} });
  const store = makeSaveStore();
  renderAdapter(store);

  await act(async () => {
    await expect(
      updateSlice(
        overwriteSlice,
        'Example',
        [],
      )(store.dispatch, store.getState),
    ).rejects.toBeDefined();
    await createSlice('Copy', [])(store.dispatch, store.getState);
  });
  expect(refresh).not.toHaveBeenCalled();
});

test('overwrite completing after unmount does not refresh the panel', async () => {
  let finishSave: (value: { id: number }) => void = () => {};
  fetchMock.put(
    'glob:*/api/v1/chart/1',
    () =>
      new Promise(resolve => {
        finishSave = resolve;
      }),
  );
  const store = makeSaveStore();
  const { unmount } = renderAdapter(store);
  const pending = updateSlice(
    overwriteSlice,
    'Example',
    [],
  )(store.dispatch, store.getState);
  await waitFor(() =>
    expect(fetchMock.callHistory.calls('glob:*/api/v1/chart/1')).toHaveLength(
      1,
    ),
  );
  unmount();
  await act(async () => {
    finishSave({ id: 1 });
    await pending;
  });
  expect(refresh).not.toHaveBeenCalled();
});

test('a real save with an unchanged timestamp invalidates an older restore hydration', async () => {
  let finishRestore: (value: object) => void = () => {};
  mockedFetchRehydration.mockReturnValue(
    new Promise(resolve => {
      finishRestore = resolve;
    }),
  );
  fetchMock.put('glob:*/api/v1/chart/1', { id: 1, result: {} });
  const store = makeSaveStore();
  renderAdapter(store);
  act(() => {
    store.setState({
      versionHistory: versionHistoryState({
        restoreCount: 1,
        lastRestoredEntityUuid: 'chart-uuid',
      }),
    });
  });
  await act(async () => {
    await updateSlice(
      overwriteSlice,
      'Example',
      [],
    )(store.dispatch, store.getState);
    finishRestore({});
  });
  expect(refresh).toHaveBeenCalledTimes(2);
  expect(mockedHydrateExplore).not.toHaveBeenCalled();
});

test('a restore of another entity does not suppress a simultaneous real chart save', async () => {
  fetchMock.put('glob:*/api/v1/chart/1', { id: 1, result: {} });
  const store = makeSaveStore();
  renderAdapter(store);
  await act(async () => {
    store.setState({
      versionHistory: versionHistoryState({
        restoreCount: 1,
        lastRestoredEntityUuid: 'another-uuid',
      }),
    });
    await updateSlice(
      overwriteSlice,
      'Example',
      [],
    )(store.dispatch, store.getState);
  });
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(mockedFetchRehydration).not.toHaveBeenCalled();
});

test('a late overwrite response after chart navigation does not refresh the new chart', async () => {
  let finishSave: (value: { id: number }) => void = () => {};
  fetchMock.put(
    'glob:*/api/v1/chart/1',
    () =>
      new Promise(resolve => {
        finishSave = resolve;
      }),
  );
  const store = makeSaveStore();
  renderAdapter(store);
  const pending = updateSlice(
    overwriteSlice,
    'Example',
    [],
  )(store.dispatch, store.getState);
  await waitFor(() =>
    expect(fetchMock.callHistory.calls('glob:*/api/v1/chart/1')).toHaveLength(
      1,
    ),
  );
  act(() => {
    store.setState({
      explore: {
        slice: {
          ...slice('2025-12-08T17:18:00'),
          slice_id: 2,
          uuid: 'chart-2',
        },
      },
    });
  });
  await act(async () => {
    finishSave({ id: 1 });
    await pending;
  });
  expect(refresh).not.toHaveBeenCalled();
  expect(mockedFetchRehydration).not.toHaveBeenCalled();
});

test('save-as navigation lets the new entity load without an extra save refresh', async () => {
  fetchMock.post('glob:*/api/v1/chart/', { id: 2, result: {} });
  const store = makeSaveStore();
  renderAdapter(store);
  await act(async () => {
    await createSlice('Copy', [])(store.dispatch, store.getState);
    store.setState({
      explore: {
        slice: {
          ...slice('2025-12-08T17:18:00'),
          slice_id: 2,
          uuid: 'chart-2',
        },
      },
    });
  });
  expect(refresh).not.toHaveBeenCalled();
});
