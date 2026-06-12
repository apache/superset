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
import { act, render, waitFor } from 'spec/helpers/testing-library';
import { hydrateExplore } from 'src/explore/actions/hydrateExplore';
import type { VersionHistoryState } from './types';
import { fetchExploreRehydrationData } from './api';
import { useVersionActivity } from './useVersionActivity';
import ExploreVersionHistory from './ExploreVersionHistory';

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
  sessionLog: [],
  restoreCount: 0,
  ...overrides,
});

interface TestSlice {
  slice_id: number;
  uuid: string;
  changed_on: string;
}

interface TestState {
  versionHistory: VersionHistoryState;
  explore: { slice?: TestSlice };
}

const slice = (changedOn: string): TestSlice => ({
  slice_id: 1,
  uuid: 'chart-uuid',
  changed_on: changedOn,
});

/** Minimal recording store: dispatched actions are captured, never reduced,
 * so tests drive state transitions explicitly via setState. */
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

const makeStore = () =>
  makeTestStore({
    versionHistory: versionHistoryState(),
    explore: { slice: slice('2025-12-08T17:18:00') },
  });

const renderAdapter = (store: ReturnType<typeof makeTestStore>) =>
  render(<ExploreVersionHistory />, { store: store as unknown as Store });

beforeEach(() => {
  mockedUseVersionActivity.mockReturnValue({
    records: [],
    timeline: [],
    count: 0,
    isLoading: false,
    error: null,
    hasMore: false,
    loadMore: jest.fn(),
    refresh,
  });
  mockedFetchRehydration.mockResolvedValue({});
  mockedHydrateExplore.mockImplementation(payload => ({
    type: HYDRATE_EXPLORE_TEST,
    payload,
  }));
});

afterEach(() => {
  jest.clearAllMocks();
});

test('refreshes the timeline when an overwrite save replaces the slice', () => {
  const store = makeStore();
  renderAdapter(store);
  expect(refresh).not.toHaveBeenCalled();

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
      versionHistory: versionHistoryState({ restoreCount: 1 }),
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
