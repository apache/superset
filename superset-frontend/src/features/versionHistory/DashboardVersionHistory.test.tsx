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
import { act, render } from 'spec/helpers/testing-library';
import type { VersionHistoryState } from './types';
import { useVersionActivity } from './useVersionActivity';
import DashboardVersionHistory from './DashboardVersionHistory';

jest.mock('./VersionHistoryPanel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('./useDashboardVersionPreview', () => ({
  useDashboardVersionPreview: jest.fn(),
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
jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => ({ addDangerToast: jest.fn() }),
}));

const mockedUseVersionActivity = useVersionActivity as jest.Mock;
const refresh = jest.fn();

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

interface TestState {
  versionHistory: VersionHistoryState;
  dashboardInfo: { uuid: string; last_modified_time: number };
  dashboardState: { hasUnsavedChanges: boolean; lastModifiedTime: number };
}

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
    dashboardInfo: { uuid: 'dash-uuid', last_modified_time: 100 },
    dashboardState: { hasUnsavedChanges: false, lastModifiedTime: 500 },
  });

const renderAdapter = (store: ReturnType<typeof makeTestStore>) =>
  render(<DashboardVersionHistory />, { store: store as unknown as Store });

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
});

afterEach(() => {
  jest.clearAllMocks();
});

test('refreshes the timeline when an edit-mode save bumps lastModifiedTime', () => {
  const store = makeStore();
  renderAdapter(store);
  expect(refresh).not.toHaveBeenCalled();

  act(() => {
    store.setState({
      dashboardState: { hasUnsavedChanges: false, lastModifiedTime: 600 },
    });
  });

  expect(refresh).toHaveBeenCalledTimes(1);
});

test('refreshes the timeline when a filter or properties save bumps last_modified_time', () => {
  const store = makeStore();
  renderAdapter(store);

  act(() => {
    store.setState({
      dashboardInfo: { uuid: 'dash-uuid', last_modified_time: 200 },
    });
  });

  expect(refresh).toHaveBeenCalledTimes(1);
});

test('does not refresh when unrelated state changes leave the save signals untouched', () => {
  const store = makeStore();
  renderAdapter(store);

  act(() => {
    store.setState({
      dashboardState: { hasUnsavedChanges: true, lastModifiedTime: 500 },
      dashboardInfo: { uuid: 'dash-uuid', last_modified_time: 100 },
    });
  });

  expect(refresh).not.toHaveBeenCalled();
});

test('a restore that also moves the save signal refreshes exactly once', () => {
  const store = makeStore();
  renderAdapter(store);

  act(() => {
    store.setState({
      versionHistory: versionHistoryState({ restoreCount: 1 }),
      dashboardState: { hasUnsavedChanges: false, lastModifiedTime: 700 },
    });
  });

  expect(refresh).toHaveBeenCalledTimes(1);
});
