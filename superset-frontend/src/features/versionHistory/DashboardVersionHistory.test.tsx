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
import { clearAllChartCustomizations } from 'src/dashboard/actions/chartCustomizationActions';
import dashboardStateReducer from 'src/dashboard/reducers/dashboardState';
import dashboardInfoReducer from 'src/dashboard/reducers/dashboardInfo';
import { onSave } from 'src/dashboard/actions/dashboardState';
import {
  dashboardInfoChanged,
  dashboardSaveSucceeded,
  nativeFiltersConfigChanged,
} from 'src/dashboard/actions/dashboardInfo';
import type { AnyAction, Store } from 'redux';
import { act, render, screen } from 'spec/helpers/testing-library';
import type { VersionHistoryState } from './types';
import { useVersionActivity } from './useVersionActivity';
import DashboardVersionHistory from './DashboardVersionHistory';

const mockPanelProps = jest.fn();
jest.mock('./VersionHistoryPanel', () => ({
  __esModule: true,
  // Renders a marker so open and closed states are distinguishable in the
  // DOM: a null-rendering mock would let the closed-state contract test
  // below pass vacuously, regardless of isPanelOpen.
  default: (props: unknown) => {
    mockPanelProps(props);
    return <div data-test="mock-version-history-panel" />;
  },
}));
jest.mock('./useDashboardVersionPreview', () => ({
  useDashboardVersionPreview: jest.fn(),
}));
jest.mock('./useVersionActions', () => ({
  useVersionActions: () => ({
    requestRestore: jest.fn(),
    openAsNew: jest.fn(),
    // The real restore modal portals out of the column (Modal renders into
    // document.body). Model that faithfully so the closed-state test can
    // assert the column stays DOM-empty even while a modal is alive.
    restoreModal: jest
      .requireActual('react-dom')
      .createPortal(
        <div data-test="mock-restore-modal" />,
        globalThis.document.body,
      ),
  }),
}));
jest.mock('./useVersionActivity', () => ({
  useVersionActivity: jest.fn(),
}));
const mockAddDangerToast = jest.fn();
jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => ({ addDangerToast: mockAddDangerToast }),
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
  isPreviewApplying: false,
  sessionLog: [],
  restoreCount: 0,
  lastRestoredEntityUuid: null,
  ...overrides,
});

interface TestState {
  versionHistory: VersionHistoryState;
  dashboardInfo: ReturnType<typeof dashboardInfoReducer>;
  dashboardState: ReturnType<typeof dashboardStateReducer>;
}

/** Reduce real dashboard saves; unrelated transitions can be driven explicitly. */
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
      state = {
        ...state,
        dashboardInfo: dashboardInfoReducer(state.dashboardInfo, action),
        dashboardState: dashboardStateReducer(state.dashboardState, action),
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
    dashboardInfo: {
      id: 1,
      uuid: 'dash-uuid',
      last_modified_time: 100,
      dash_edit_perm: true,
    },
    dashboardState: { hasUnsavedChanges: false, lastModifiedTime: 500 },
  });

const renderAdapter = (store: ReturnType<typeof makeTestStore>) =>
  render(<DashboardVersionHistory />, { store: store as unknown as Store });

beforeEach(() => {
  mockedUseVersionActivity.mockReturnValue({
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
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

test('refreshes the timeline on a real edit-mode save', () => {
  const store = makeStore();
  renderAdapter(store);
  expect(refresh).not.toHaveBeenCalled();

  act(() => {
    store.dispatch(onSave(600));
  });

  expect(refresh).toHaveBeenCalledTimes(1);
});

test('timestamp metadata changes do not duplicate a successful properties refresh', () => {
  const store = makeStore();
  renderAdapter(store);

  act(() => {
    store.dispatch(dashboardSaveSucceeded(1));
  });
  act(() => {
    store.dispatch(dashboardInfoChanged({ description: 'updated' }));
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
      versionHistory: versionHistoryState({
        restoreCount: 1,
        lastRestoredEntityUuid: 'dash-uuid',
      }),
      dashboardState: { hasUnsavedChanges: false, lastModifiedTime: 700 },
    });
  });

  expect(refresh).toHaveBeenCalledTimes(1);
});

test('preview is blocked while the dashboard has unsaved edit-mode changes', () => {
  const store = makeTestStore({
    versionHistory: versionHistoryState(),
    dashboardInfo: { uuid: 'dash-uuid', last_modified_time: 100 },
    dashboardState: { hasUnsavedChanges: true, lastModifiedTime: 500 },
  });
  renderAdapter(store);

  const { onPreview } = mockPanelProps.mock.lastCall[0];
  act(() => {
    onPreview({
      type: 'group',
      transactionId: 10,
      versionUuid: 'v-1',
      issuedAt: '2025-12-05T17:18:00',
      changedBy: null,
      actionKind: null,
      records: [],
    });
  });

  // Previewing would rehydrate the dashboard and wipe the unsaved work;
  // the user is told to save or discard instead.
  expect(mockAddDangerToast).toHaveBeenCalled();
  expect(
    store.actions.some(action => action.type === 'SET_VERSION_PREVIEW'),
  ).toBe(false);
});

test('offers restore to an editor of a normally managed dashboard', () => {
  const store = makeStore();
  renderAdapter(store);

  expect(mockPanelProps).toHaveBeenCalledWith(
    expect.objectContaining({ canRestore: true }),
  );
});

test('withholds restore on an externally managed dashboard', () => {
  // The header menu hides the entry for these, but the panel also opens from
  // ?version_history=true and the restore endpoint has no
  // is_managed_externally check -- so this gate is the only thing standing
  // between a URL param and a restore that the next sync would undo.
  const store = makeTestStore({
    versionHistory: versionHistoryState(),
    dashboardInfo: {
      uuid: 'dash-uuid',
      last_modified_time: 100,
      dash_edit_perm: true,
      is_managed_externally: true,
    },
    dashboardState: { hasUnsavedChanges: false, lastModifiedTime: 500 },
  });
  renderAdapter(store);

  expect(mockPanelProps).toHaveBeenCalledWith(
    expect.objectContaining({ canRestore: false }),
  );
});

test('renders nothing in place while the panel is closed', () => {
  // The DashboardBuilder overlay relies on this contract: the closed
  // column must stay DOM-empty (the restore modal portals out of it), or
  // the :empty shadow guard stops matching and a stray shadow line appears
  // at the viewport edge below the overlay breakpoint (sc-119737). The
  // panel mock renders a marker and the restore-modal mock portals a
  // marker into document.body, so this test fails if the closed state
  // ever renders the panel — or any wrapper element — in place.
  const store = makeTestStore({
    versionHistory: versionHistoryState({ isPanelOpen: false }),
    dashboardInfo: {
      uuid: 'dash-uuid',
      last_modified_time: 100,
      dash_edit_perm: true,
    },
    dashboardState: { hasUnsavedChanges: false, lastModifiedTime: 500 },
  });
  const { container } = renderAdapter(store);
  expect(container).toBeEmptyDOMElement();
  // The modal is alive OUTSIDE the column — the guard is specifically
  // about in-place emptiness, not about nothing rendering at all.
  expect(screen.getByTestId('mock-restore-modal')).toBeInTheDocument();
  expect(
    screen.queryByTestId('mock-version-history-panel'),
  ).not.toBeInTheDocument();
});

test('renders the panel in place while open — the closed-state discriminator', () => {
  // Companion control for the contract test above: with the panel open the
  // very same container is non-empty. Together the pair proves the
  // closed-state assertion turns on isPanelOpen rather than on mocks that
  // render nothing in either state.
  const store = makeStore();
  const { container } = renderAdapter(store);
  expect(container).not.toBeEmptyDOMElement();
  expect(screen.getByTestId('mock-version-history-panel')).toBeInTheDocument();
});

test.each(['edit', 'properties', 'native filters'])(
  'real %s success reducer refreshes history for successive saves in the same second',
  path => {
    const now = jest.spyOn(Date.prototype, 'getTime').mockReturnValue(100000);
    try {
      const store = makeStore();
      renderAdapter(store);
      for (let save = 1; save <= 2; save += 1) {
        act(() => {
          if (path === 'edit') {
            store.dispatch(onSave(500));
          } else if (path === 'properties') {
            store.dispatch(dashboardSaveSucceeded(1));
          } else {
            store.dispatch(nativeFiltersConfigChanged([]));
          }
        });
        expect(refresh).toHaveBeenCalledTimes(save);
      }
    } finally {
      now.mockRestore();
    }
  },
);

test('local properties and customization edits do not refresh server history', () => {
  const store = makeStore();
  renderAdapter(store);
  act(() => {
    store.dispatch(dashboardInfoChanged({ description: 'Draft' }));
  });
  act(() => {
    store.dispatch(clearAllChartCustomizations());
  });
  expect(refresh).not.toHaveBeenCalled();
});

test('a late properties save for another dashboard does not refresh this one', () => {
  const store = makeStore();
  renderAdapter(store);
  act(() => {
    store.dispatch(dashboardSaveSucceeded(2));
  });
  expect(refresh).not.toHaveBeenCalled();
});
