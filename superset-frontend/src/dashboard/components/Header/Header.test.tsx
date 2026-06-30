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
import * as redux from 'redux';
import { useUnsavedChangesPrompt } from 'src/hooks/useUnsavedChangesPrompt';
import { screen, userEvent, within, waitFor } from '@superset-ui/core/spec';
import { act } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { getExtensionsRegistry, JsonObject } from '@superset-ui/core';
import setupCodeOverrides from 'src/setup/setupCodeOverrides';
import getOwnerName from 'src/utils/getOwnerName';
import { render, createStore } from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import Header from '.';
import {
  useDashboardStateStore,
  useDashboardLayoutStore,
  useDashboardInfoStore,
  type DashboardStateStore,
} from 'src/dashboard/stores';
import type { DashboardInfo } from 'src/dashboard/types';
import { DASHBOARD_HEADER_ID } from '../../util/constants';
import { AutoRefreshStatus } from '../../types/autoRefresh';

const mockHistoryReplace = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({
    replace: mockHistoryReplace,
  }),
  useLocation: jest.fn(() => ({
    pathname: '/dashboard',
    search: '?standalone=1',
    hash: '',
    state: undefined,
  })),
}));

const initialState = {
  dashboardInfo: {
    id: 1,
    dash_edit_perm: false,
    dash_save_perm: false,
    dash_share_perm: false,
    userId: '1',
    metadata: {},
    common: {
      conf: {
        DASHBOARD_AUTO_REFRESH_INTERVALS: [
          [0, "Don't refresh"],
          [10, '10 seconds'],
        ],
      },
    },
    changed_on_delta_humanized: '7 minutes ago',
    changed_by: {
      id: 3,
      first_name: 'John',
      last_name: 'Doe',
    },
    created_on_delta_humanized: '10 days ago',
    created_by: {
      id: 2,
      first_name: 'Kay',
      last_name: 'Mon',
    },
    owners: [{ first_name: 'John', last_name: 'Doe', id: 1 }],
  },
  user: {
    createdOn: '2021-04-27T18:12:38.952304',
    email: 'admin@test.com',
    firstName: 'admin',
    isActive: true,
    lastName: 'admin',
    permissions: {},
    roles: { Admin: [['menu_access', 'Manage']] },
    userId: 1,
    username: 'admin',
  },
  dashboardState: {
    sliceIds: [],
    expandedSlices: {},
    refreshFrequency: 0,
    shouldPersistRefreshFrequency: false,
    css: '',
    isStarred: false,
    isPublished: false,
    hasUnsavedChanges: false,
    maxUndoHistoryExceeded: false,
    editMode: false,
    lastModifiedTime: 0,
  },
  charts: {},
  dashboardLayout: {
    present: {
      [DASHBOARD_HEADER_ID]: {
        meta: {
          text: 'Dashboard Title',
        },
      },
    },
    past: [],
    future: [],
  },
};

const editableState = {
  dashboardState: {
    ...initialState.dashboardState,
    editMode: true,
  },
  dashboardInfo: {
    ...initialState.dashboardInfo,
    dash_edit_perm: true,
    dash_save_perm: true,
  },
};

fetchMock.get('glob:*/csstemplateasyncmodelview/api/read', {});

function setup(overrideState: JsonObject = {}) {
  const mergedState = { ...initialState, ...overrideState };
  const ds = mergedState.dashboardState as
    | Partial<DashboardStateStore>
    | undefined;
  if (ds) {
    useDashboardStateStore.setState(ds);
  }
  const layoutPresent =
    (mergedState.dashboardLayout as any)?.present ??
    initialState.dashboardLayout.present;
  useDashboardLayoutStore.setState({ layout: layoutPresent });
  useDashboardInfoStore.setState({
    dashboardInfo: (mergedState.dashboardInfo ??
      {}) as unknown as DashboardInfo,
  });
  // Seeding the layout is not an undoable edit — clear the zundo history so
  // the undo/redo buttons start disabled.
  useDashboardLayoutStore.temporal.getState().clear();
  return render(
    <div className="dashboard">
      <Header />
    </div>,
    {
      useRedux: true,
      useTheme: true,
      initialState: mergedState,
    },
  );
}

async function openActionsDropdown() {
  const btn = screen.getByRole('img', { name: 'ellipsis' });
  userEvent.click(btn);
  expect(await screen.findByTestId('header-actions-menu')).toBeInTheDocument();
}

const addSuccessToast = jest.fn();
const addDangerToast = jest.fn();
const addWarningToast = jest.fn();
const onUndo = jest.fn();
const onRedo = jest.fn();
const setEditMode = jest.fn();
const fetchCharts = jest.fn();
const updateDashboardTitle = jest.fn();
const updateCss = jest.fn();
const onSave = jest.fn();
const setMaxUndoHistoryExceeded = jest.fn();
const maxUndoHistoryToast = jest.fn();
const logEvent = jest.fn();
const setRefreshFrequency = jest.fn();
const onRefresh = jest.fn();
const dashboardTitleChanged = jest.fn();
const startAutoRefresh = jest.fn();
const endAutoRefresh = jest.fn();
const setRefreshInFlight = jest.fn();
const setStatus = jest.fn();
const setFetchStartTime = jest.fn();
const recordSuccess = jest.fn();
const recordError = jest.fn();
const setPaused = jest.fn();
const setPausedByTab = jest.fn();

jest.mock('src/hooks/useUnsavedChangesPrompt', () => ({
  useUnsavedChangesPrompt: jest.fn(),
}));

// Stub the save mutation so we can assert clicks fire .mutate exactly once
// without dispatching the underlying saveDashboardRequest thunk. Mock the
// submodule directly (not the barrel) to avoid re-evaluating queries/index,
// whose circular import with dashboardState breaks under jest.requireActual.
const mockSaveDashboardMutate = jest.fn();
jest.mock('src/dashboard/queries/useSaveDashboard/useSaveDashboard', () => ({
  useSaveDashboard: () => ({
    mutate: mockSaveDashboardMutate,
    mutateAsync: mockSaveDashboardMutate,
    isPending: false,
    reset: jest.fn(),
  }),
}));
// PublishedStatus publishes via the usePublishDashboard mutation hook.
const mockPublish = jest.fn();
jest.mock(
  'src/dashboard/queries/usePublishDashboard/usePublishDashboard',
  () => ({
    usePublishDashboard: () => ({ mutate: mockPublish }),
  }),
);
// Favoriting flows through the favorite query/mutation hooks. Mock the
// submodules directly (not the barrel) to avoid re-evaluating queries/index.
const mockUseFavoriteStatus = jest.fn((_id: number, _enabled?: boolean) => ({
  data: undefined,
}));
jest.mock('src/dashboard/queries/useFavoriteStatus/useFavoriteStatus', () => ({
  useFavoriteStatus: (id: number, enabled?: boolean) =>
    mockUseFavoriteStatus(id, enabled),
}));
const mockToggleFavorite = jest.fn();
jest.mock('src/dashboard/queries/useToggleFavorite/useToggleFavorite', () => ({
  useToggleFavorite: () => ({ mutate: mockToggleFavorite }),
}));
jest.mock('src/dashboard/contexts/AutoRefreshContext', () => ({
  useAutoRefreshContext: jest.fn(),
}));
jest.mock('src/dashboard/hooks/useRealTimeDashboard', () => ({
  useRealTimeDashboard: jest.fn(),
}));
jest.mock('src/dashboard/hooks/useAutoRefreshTabPause', () => ({
  useAutoRefreshTabPause: jest.fn(),
}));

const useAutoRefreshContextMock = jest.requireMock(
  'src/dashboard/contexts/AutoRefreshContext',
).useAutoRefreshContext as jest.Mock;
const useRealTimeDashboardMock = jest.requireMock(
  'src/dashboard/hooks/useRealTimeDashboard',
).useRealTimeDashboard as jest.Mock;
const useAutoRefreshTabPauseMock = jest.requireMock(
  'src/dashboard/hooks/useAutoRefreshTabPause',
).useAutoRefreshTabPause as jest.Mock;
beforeAll(() => {
  jest.spyOn(redux, 'bindActionCreators').mockImplementation(() => ({
    addSuccessToast,
    addDangerToast,
    addWarningToast,
    onUndo,
    onRedo,
    setEditMode,
    fetchCharts,
    updateDashboardTitle,
    updateCss,
    onSave,
    setMaxUndoHistoryExceeded,
    maxUndoHistoryToast,
    logEvent,
    setRefreshFrequency,
    onRefresh,
    dashboardTitleChanged,
  }));
});

beforeEach(() => {
  jest.clearAllMocks();
  const { useLocation } = jest.requireMock('react-router-dom');
  useLocation.mockReturnValue({
    pathname: '/dashboard',
    search: '?standalone=1',
    hash: '',
    state: undefined,
  });

  (useUnsavedChangesPrompt as jest.Mock).mockReturnValue({
    showModal: false,
    setShowModal: jest.fn(),
    handleConfirmNavigation: jest.fn(),
    handleSaveAndCloseModal: jest.fn(),
  });
  useAutoRefreshContextMock.mockReturnValue({
    startAutoRefresh,
    endAutoRefresh,
    setRefreshInFlight,
  });
  useRealTimeDashboardMock.mockReturnValue({
    isPaused: false,
    setStatus,
    setPaused,
    setPausedByTab,
    recordSuccess,
    recordError,
    setFetchStartTime,
  });
  useAutoRefreshTabPauseMock.mockImplementation(() => {});
  fetchCharts.mockImplementation(() => undefined);
  onRefresh.mockResolvedValue(undefined);

  window.history.pushState({}, 'Test page', '/dashboard?standalone=1');
});

test('should render', () => {
  const { container } = setup();
  expect(container).toBeInTheDocument();
});

test('should render the title', () => {
  setup();
  expect(screen.getByTestId('editable-title-input')).toHaveDisplayValue(
    'Dashboard Title',
  );
});

test('should render the editable title', () => {
  setup(editableState);
  expect(screen.getByDisplayValue('Dashboard Title')).toBeInTheDocument();
});

test('should edit the title', () => {
  setup(editableState);
  useDashboardStateStore.setState({ hasUnsavedChanges: false });
  const editableTitle = screen.getByDisplayValue('Dashboard Title');
  expect(useDashboardStateStore.getState().hasUnsavedChanges).toBe(false);
  userEvent.click(editableTitle);
  userEvent.clear(editableTitle);
  userEvent.type(editableTitle, 'New Title');
  userEvent.click(document.body);
  expect(useDashboardStateStore.getState().hasUnsavedChanges).toBe(true);
  expect(screen.getByDisplayValue('New Title')).toBeInTheDocument();
});

test('typing in the title enables Save immediately and commits once on blur', () => {
  setup(editableState);
  useDashboardStateStore.setState({ hasUnsavedChanges: false });
  const editableTitle = screen.getByDisplayValue('Dashboard Title');
  // Title commits now route through the Zustand layout store.
  const titleSpy = jest.spyOn(
    useDashboardLayoutStore.getState(),
    'updateDashboardTitle',
  );
  userEvent.click(editableTitle);
  userEvent.clear(editableTitle);
  userEvent.type(editableTitle, 'abcdef');
  // Save enables as soon as the title diverges (unsaved flagged on the store),
  // but the title isn't committed per keystroke.
  expect(useDashboardStateStore.getState().hasUnsavedChanges).toBe(true);
  expect(titleSpy).not.toHaveBeenCalled();
  // Commit by blurring
  userEvent.click(document.body);
  expect(titleSpy).toHaveBeenCalledTimes(1);
  expect(titleSpy).toHaveBeenCalledWith('abcdef');
  titleSpy.mockRestore();
});

test('should render the "Draft" status', () => {
  setup();
  expect(screen.getByText('Draft')).toBeInTheDocument();
});

test('should publish', () => {
  const canEditState = {
    dashboardInfo: {
      ...initialState.dashboardInfo,
      dash_edit_perm: true,
      dash_save_perm: true,
    },
  };
  setup(canEditState);
  const draft = screen.getByText('Draft');
  expect(mockPublish).toHaveBeenCalledTimes(0);
  userEvent.click(draft);
  expect(mockPublish).toHaveBeenCalledWith(true);
});

test('should render metadata', () => {
  setup();
  expect(
    screen.getByText(getOwnerName(initialState.dashboardInfo.created_by)),
  ).toBeInTheDocument();
  expect(
    screen.getByText(initialState.dashboardInfo.changed_on_delta_humanized),
  ).toBeInTheDocument();
});

// Pushes a real layout change so the zundo temporal store records a past
// state, then re-renders are flushed via act().
function createLayoutHistory() {
  act(() => {
    useDashboardLayoutStore.getState().updateComponents({
      [DASHBOARD_HEADER_ID]: {
        id: DASHBOARD_HEADER_ID,
        type: 'HEADER',
        children: [],
        meta: { text: 'Edited Title' },
      },
    });
  });
}

test('should render the "Undo" action as disabled', () => {
  setup(editableState);
  expect(screen.getByTestId('undo-action').parentElement).toBeDisabled();
});

test('should undo when past actions exist', () => {
  setup(editableState);
  createLayoutHistory();
  const undo = screen.getByTestId('undo-action');

  expect(undo.parentElement).toBeEnabled();
  expect(useDashboardLayoutStore.temporal.getState().pastStates).toHaveLength(
    1,
  );

  userEvent.click(undo);
  // The zundo undo popped the past state.
  expect(useDashboardLayoutStore.temporal.getState().pastStates).toHaveLength(
    0,
  );
});

test('undo does not clear unsaved changes flagged by non-layout edits', () => {
  setup(editableState);
  createLayoutHistory();
  // A non-layout edit (theme/properties) marks the dashboard dirty.
  useDashboardStateStore.setState({ hasUnsavedChanges: true });

  userEvent.click(screen.getByTestId('undo-action'));

  // Layout history is rewound, but the non-layout dirty flag must survive.
  expect(useDashboardLayoutStore.temporal.getState().pastStates).toHaveLength(
    0,
  );
  expect(useDashboardStateStore.getState().hasUnsavedChanges).toBe(true);
});

test('should render the "Redo" action as disabled', () => {
  setup(editableState);
  expect(screen.getByTestId('redo-action').parentElement).toBeDisabled();
});

test('should have correct redo button structure', () => {
  setup(editableState);

  const redo = screen.getByTestId('redo-action');
  const redoButton = redo.parentElement;

  expect(redoButton).toBeInTheDocument();
  expect(redo).toBeInTheDocument();
  expect(redoButton).toBeDisabled();
});

test('should enable undo button when past actions exist', () => {
  setup(editableState);
  createLayoutHistory();

  expect(screen.getByTestId('undo-action').parentElement).toBeEnabled();
  expect(screen.getByTestId('redo-action').parentElement).toBeDisabled();
});

test('should enable redo button after undo creates future history', () => {
  setup(editableState);
  createLayoutHistory();

  expect(screen.getByTestId('undo-action').parentElement).toBeEnabled();

  userEvent.click(screen.getByTestId('undo-action'));

  // The undo moved the state into the future stack — redo is now available.
  expect(screen.getByTestId('redo-action').parentElement).toBeEnabled();
  expect(useDashboardLayoutStore.temporal.getState().futureStates).toHaveLength(
    1,
  );

  userEvent.click(screen.getByTestId('redo-action'));
  expect(useDashboardLayoutStore.temporal.getState().futureStates).toHaveLength(
    0,
  );
});

test('should enable undo button when real actions create past history', () => {
  setup(editableState);

  expect(screen.getByTestId('undo-action').parentElement).toBeDisabled();

  createLayoutHistory();

  expect(screen.getByTestId('undo-action').parentElement).toBeEnabled();
});

test('should disable both buttons when no actions available', () => {
  setup(editableState);

  expect(screen.getByTestId('undo-action').parentElement).toBeDisabled();
  expect(screen.getByTestId('redo-action').parentElement).toBeDisabled();
});

test('should render the "Discard changes" button', () => {
  setup(editableState);
  expect(screen.getByText('Discard')).toBeInTheDocument();
});

test('should render the "Save" button as disabled', () => {
  setup(editableState);
  expect(screen.getByText('Save').parentElement).toBeDisabled();
});

test('should save', () => {
  mockSaveDashboardMutate.mockClear();
  const unsavedState = {
    ...editableState,
    dashboardState: {
      ...editableState.dashboardState,
      hasUnsavedChanges: true,
    },
  };
  setup(unsavedState);
  const save = screen.getByText('Save');
  expect(mockSaveDashboardMutate).not.toHaveBeenCalled();
  userEvent.click(save);
  expect(mockSaveDashboardMutate).toHaveBeenCalledTimes(1);
});

test('should NOT render the "Draft" status', () => {
  const publishedState = {
    ...initialState,
    dashboardState: {
      ...initialState.dashboardState,
      isPublished: true,
    },
  };
  setup(publishedState);
  expect(screen.queryByText('Draft')).not.toBeInTheDocument();
});

test('should render the unselected fave icon', () => {
  setup();
  expect(mockUseFavoriteStatus).toHaveBeenCalled();
  expect(screen.getByRole('img', { name: 'unstarred' })).toBeInTheDocument();
});

test('should render the selected fave icon', () => {
  const favedState = {
    dashboardState: {
      ...initialState.dashboardState,
      isStarred: true,
    },
  };
  setup(favedState);
  expect(screen.getByRole('img', { name: 'starred' })).toBeInTheDocument();
});

test('should NOT render the fave icon on anonymous user', () => {
  const anonymousUserState = {
    user: undefined,
  };
  setup(anonymousUserState);
  expect(() => screen.getByRole('img', { name: 'unstarred' })).toThrow(
    'Unable to find',
  );
  expect(() => screen.getByRole('img', { name: 'starred' })).toThrow(
    'Unable to find',
  );
});

test('should fave', async () => {
  setup();
  const fave = screen.getByRole('img', { name: 'unstarred' });
  expect(mockToggleFavorite).not.toHaveBeenCalled();
  userEvent.click(fave);
  expect(mockToggleFavorite).toHaveBeenCalledTimes(1);
});

// FaveStar.onClick passes the *prior* isStarred value through; the toggle
// mutation flips it. So favoriting (unstarred → starred) sends `false`, and
// unfavoriting (starred → unstarred) sends `true`.
test('should toggle favorite with false when favoriting from the header', () => {
  setup();
  const header = screen.getByTestId('dashboard-header-container');

  userEvent.click(within(header).getByRole('img', { name: 'unstarred' }));
  expect(mockToggleFavorite).toHaveBeenCalledTimes(1);
  expect(mockToggleFavorite).toHaveBeenCalledWith(false);
});

test('should toggle favorite with true when unfavoriting from the header', () => {
  setup({
    dashboardState: { ...initialState.dashboardState, isStarred: true },
  });
  const header = screen.getByTestId('dashboard-header-container');

  userEvent.click(within(header).getByRole('img', { name: 'starred' }));
  expect(mockToggleFavorite).toHaveBeenCalledTimes(1);
  expect(mockToggleFavorite).toHaveBeenCalledWith(true);
});

test('should toggle the edit mode', () => {
  const canEditState = {
    dashboardInfo: {
      ...initialState.dashboardInfo,
      dash_edit_perm: true,
    },
  };
  setup(canEditState);
  const editDashboard = screen.getByText('Edit dashboard');
  expect(screen.queryByText('Edit dashboard')).toBeInTheDocument();
  userEvent.click(editDashboard);
  expect(logEvent).toHaveBeenCalled();
});

test('should NOT render the Edit dashboard button when embedded', () => {
  // Embedded (Embedded SDK) dashboards authenticate with a guest token and so
  // have no userId. The Edit button must be hidden even with edit permission,
  // since the embedded context cannot handle entering/exiting edit mode.
  const embeddedCanEditState = {
    dashboardInfo: {
      ...initialState.dashboardInfo,
      dash_edit_perm: true,
      userId: undefined,
    },
  };
  setup(embeddedCanEditState);
  expect(screen.queryByTestId('edit-dashboard-button')).not.toBeInTheDocument();
});

test('should render the dropdown icon', () => {
  setup();
  expect(screen.getByRole('img', { name: 'ellipsis' })).toBeInTheDocument();
});

test('should refresh the charts', async () => {
  setup({
    dashboardState: {
      ...initialState.dashboardState,
      sliceIds: [1],
    },
    charts: {
      1: { latestQueryFormData: { metric: 'value' } },
    },
  });
  await openActionsDropdown();
  userEvent.click(screen.getByText('Refresh dashboard'));
  expect(onRefresh).toHaveBeenCalledTimes(1);
});

test('auto-refresh uses onRefresh with skipped filters and toggles refresh state', async () => {
  jest.useFakeTimers({ advanceTimers: true });
  onRefresh.mockResolvedValue(undefined);

  const originalRequestAnimationFrame = window.requestAnimationFrame;
  window.requestAnimationFrame = callback => {
    callback(0);
    return 0;
  };

  try {
    setup({
      dashboardState: {
        ...initialState.dashboardState,
        refreshFrequency: 10,
        sliceIds: [1, 2],
      },
      charts: {
        1: { latestQueryFormData: { metric: 'a' }, chartStatus: 'success' },
        2: { latestQueryFormData: { metric: 'b' }, chartStatus: 'success' },
      },
    });

    jest.advanceTimersByTime(10000);
    await waitFor(() =>
      expect(onRefresh).toHaveBeenCalledWith([1, 2], true, 2000, 1, true),
    );

    expect(fetchCharts).not.toHaveBeenCalled();
    expect(startAutoRefresh).toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(AutoRefreshStatus.Fetching);
    expect(setRefreshInFlight).toHaveBeenCalledWith(true);
    expect(setRefreshInFlight).toHaveBeenCalledWith(false);
    expect(endAutoRefresh).toHaveBeenCalled();
  } finally {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    jest.useRealTimers();
  }
});

test('resume clears tab pause flag', () => {
  useRealTimeDashboardMock.mockReturnValue({
    isRealTimeDashboard: true,
    isPaused: true,
    isPausedByTab: true,
    effectiveStatus: AutoRefreshStatus.Paused,
    lastSuccessfulRefresh: null,
    lastAutoRefreshTime: null,
    refreshErrorCount: 0,
    refreshFrequency: 10,
    setStatus,
    setPaused,
    setPausedByTab,
    recordSuccess,
    recordError,
    setFetchStartTime,
    autoRefreshPauseOnInactiveTab: true,
    setPauseOnInactiveTab: jest.fn(),
  });

  setup({
    dashboardState: {
      ...initialState.dashboardState,
      refreshFrequency: 10,
    },
  });

  userEvent.click(screen.getByTestId('auto-refresh-toggle'));

  expect(setPaused).toHaveBeenCalledWith(false);
  expect(setPausedByTab).toHaveBeenCalledWith(false);
});

test('should render an extension component if one is supplied', () => {
  const extensionsRegistry = getExtensionsRegistry();
  extensionsRegistry.set('dashboard.nav.right', () => (
    <>dashboard.nav.right extension component</>
  ));
  setupCodeOverrides();

  setup();
  expect(
    screen.getByText('dashboard.nav.right extension component'),
  ).toBeInTheDocument();
});

test('should NOT render MetadataBar when in edit mode', () => {
  const state = {
    ...editableState,
    dashboardInfo: {
      ...initialState.dashboardInfo,
      userId: '123',
    },
  };
  setup(state);
  expect(
    screen.queryByText(state.dashboardInfo.changed_on_delta_humanized),
  ).not.toBeInTheDocument();
});

test('should NOT render MetadataBar when embedded', () => {
  const state = {
    dashboardInfo: {
      ...initialState.dashboardInfo,
      userId: undefined,
    },
  };
  setup(state);
  expect(
    screen.queryByText(state.dashboardInfo.changed_on_delta_humanized),
  ).not.toBeInTheDocument();
});

test('should hide edit button and navbar, and show Exit fullscreen when in fullscreen mode', () => {
  const fullscreenState = {
    ...initialState,
    dashboardState: {
      ...initialState.dashboardState,
      isFullscreenMode: true,
    },
  };

  setup(fullscreenState);
  expect(screen.queryByTestId('edit-dashboard-button')).not.toBeInTheDocument();
  expect(screen.getByTestId('actions-trigger')).toBeInTheDocument();
  expect(screen.queryByTestId('main-navigation')).not.toBeInTheDocument();
});

test('should show Exit fullscreen when in fullscreen mode', async () => {
  setup();

  userEvent.click(screen.getByTestId('actions-trigger'));

  expect(await screen.findByText('Exit fullscreen')).toBeInTheDocument();
});

test('should have fullscreen option in dropdown', async () => {
  setup();
  await openActionsDropdown();
  expect(screen.getByText('Exit fullscreen')).toBeInTheDocument();
  expect(screen.queryByText('Enter fullscreen')).not.toBeInTheDocument();
});

test('should render MetadataBar when not in edit mode and not embedded', () => {
  const state = {
    dashboardInfo: {
      ...initialState.dashboardInfo,
      userId: '123',
    },
  };
  setup(state);
  expect(
    screen.getByText(state.dashboardInfo.changed_on_delta_humanized),
  ).toBeInTheDocument();
});

test('should show UnsavedChangesModal when there are unsaved changes and user tries to navigate', async () => {
  (useUnsavedChangesPrompt as jest.Mock).mockReturnValue({
    showModal: true,
    setShowModal: jest.fn(),
    handleConfirmNavigation: jest.fn(),
    handleSaveAndCloseModal: jest.fn(),
  });

  setup({ ...editableState });

  const modalTitle: HTMLElement = await screen.findByText(
    'Save changes to your dashboard?',
  );

  const modalBody: HTMLElement = await screen.findByText(
    "If you don't save, changes will be lost.",
  );

  expect(modalTitle).toBeInTheDocument();
  expect(modalBody).toBeInTheDocument();
});

test('should call handleSaveAndCloseModal when Save is clicked in UnsavedChangesModal', async () => {
  const handleSaveAndCloseModal = jest.fn();

  (useUnsavedChangesPrompt as jest.Mock).mockReturnValue({
    showModal: true,
    setShowModal: jest.fn(),
    handleConfirmNavigation: jest.fn(),
    handleSaveAndCloseModal,
  });

  setup({ ...editableState });

  const modal: HTMLElement = await screen.findByRole('dialog');
  const saveButton: HTMLElement = within(modal).getByRole('button', {
    name: /save/i,
  });

  userEvent.click(saveButton);

  expect(handleSaveAndCloseModal).toHaveBeenCalled();
});

test('should call handleConfirmNavigation when user confirms navigation in UnsavedChangesModal', async () => {
  const handleConfirmNavigation = jest.fn();

  (useUnsavedChangesPrompt as jest.Mock).mockReturnValue({
    showModal: true,
    setShowModal: jest.fn(),
    handleConfirmNavigation,
    handleSaveAndCloseModal: jest.fn(),
  });

  setup({ ...editableState });

  const modal: HTMLElement = await screen.findByRole('dialog');
  const discardButton: HTMLElement = within(modal).getByRole('button', {
    name: /discard/i,
  });

  userEvent.click(discardButton);

  expect(handleConfirmNavigation).toHaveBeenCalled();
});

test('should call setShowUnsavedChangesModal(false) on cancel', async () => {
  const setShowModal = jest.fn();

  (useUnsavedChangesPrompt as jest.Mock).mockReturnValue({
    showModal: true,
    setShowModal,
    handleConfirmNavigation: jest.fn(),
    handleSaveAndCloseModal: jest.fn(),
  });

  setup({ ...editableState });

  const modal: HTMLElement = await screen.findByRole('dialog');
  const closeButton: HTMLElement = within(modal).getByRole('button', {
    name: /close/i,
  });

  userEvent.click(closeButton);

  expect(setShowModal).toHaveBeenCalledWith(false);
});

test('should clear history and unsaved changes when entering edit mode', () => {
  const canEditState = {
    dashboardInfo: {
      ...initialState.dashboardInfo,
      dash_edit_perm: true,
    },
  };

  setup(canEditState);
  useDashboardStateStore.setState({ hasUnsavedChanges: true });

  // Seed zundo history so we can prove entering edit mode clears it.
  createLayoutHistory();
  expect(
    useDashboardLayoutStore.temporal.getState().pastStates.length,
  ).toBeGreaterThan(0);

  const editButton = screen.getByText('Edit dashboard');
  userEvent.click(editButton);

  expect(useDashboardLayoutStore.temporal.getState().pastStates).toHaveLength(
    0,
  );
  expect(useDashboardStateStore.getState().hasUnsavedChanges).toBe(false);
});

test('should mark theme change as unsaved when in edit mode', async () => {
  useDashboardStateStore.setState({ editMode: true });
  const dashboardInfo = {
    ...editableState.dashboardInfo,
    theme: 'LIGHT',
  };
  const testStore = createStore(
    {
      ...initialState,
      ...editableState,
      dashboardInfo,
    },
    reducerIndex,
  );
  useDashboardInfoStore.setState({
    dashboardInfo: dashboardInfo as unknown as DashboardInfo,
  });
  useDashboardStateStore.setState({ hasUnsavedChanges: false });

  render(
    <div className="dashboard">
      <Header />
    </div>,
    {
      useRedux: true,
      useTheme: true,
      store: testStore,
    },
  );

  expect(useDashboardStateStore.getState().hasUnsavedChanges).toBe(false);

  act(() => {
    useDashboardInfoStore.setState({
      dashboardInfo: {
        ...dashboardInfo,
        theme: 'DARK',
      } as unknown as DashboardInfo,
    });
  });

  await waitFor(() => {
    expect(useDashboardStateStore.getState().hasUnsavedChanges).toBe(true);
  });
});

test('should not mark initial theme as unsaved change', () => {
  useDashboardStateStore.setState({ hasUnsavedChanges: false });
  setup({
    ...editableState,
    dashboardInfo: {
      ...editableState.dashboardInfo,
      theme: 'LIGHT',
    },
  });

  expect(useDashboardStateStore.getState().hasUnsavedChanges).toBe(false);
});

test('should sync theme ref when navigating between dashboards', async () => {
  const dashboardInfo = {
    ...initialState.dashboardInfo,
    theme: 'LIGHT',
  };
  const testStore = createStore(
    {
      ...initialState,
      dashboardInfo,
    },
    reducerIndex,
  );
  useDashboardInfoStore.setState({
    dashboardInfo: dashboardInfo as unknown as DashboardInfo,
  });
  useDashboardStateStore.setState({ hasUnsavedChanges: false });

  render(
    <div className="dashboard">
      <Header />
    </div>,
    {
      useRedux: true,
      useTheme: true,
      store: testStore,
    },
  );

  // Navigating to another dashboard updates the dashboardInfo Zustand store
  // (the real mechanism post-migration), which should sync the theme ref
  // without marking unsaved changes.
  useDashboardInfoStore.setState({
    dashboardInfo: {
      ...dashboardInfo,
      id: 2,
      theme: 'DARK',
    } as unknown as DashboardInfo,
  });

  await waitFor(() => {
    expect(useDashboardStateStore.getState().hasUnsavedChanges).toBe(false);
  });
});

test('should not duplicate subdirectory prefix when toggling fullscreen', async () => {
  const { useLocation } = jest.requireMock('react-router-dom');
  // Simulate React Router with basename=/pcs: useLocation returns path relative to basename
  useLocation.mockReturnValue({
    pathname: '/dashboard',
    search: '?standalone=1',
    hash: '',
    state: undefined,
  });
  // Simulate browser URL including the subdirectory prefix
  window.history.pushState({}, 'Test page', '/pcs/dashboard?standalone=1');

  setup();
  await openActionsDropdown();
  userEvent.click(screen.getByText('Exit fullscreen'));

  // history.replace must be called with the Router-relative path, not window.location.pathname.
  // If the subdirectory prefix (/pcs) were included, React Router would prepend it again,
  // producing /pcs/pcs/dashboard (the bug). The path must start with /dashboard, not /pcs/.
  expect(mockHistoryReplace).toHaveBeenCalledWith(
    expect.not.stringMatching(/^\/pcs\//),
  );
  expect(mockHistoryReplace).toHaveBeenCalledWith(
    expect.stringMatching(/^\/dashboard(\?|$)/),
  );
});

test('should not duplicate subdirectory prefix when entering fullscreen', async () => {
  const { useLocation } = jest.requireMock('react-router-dom');
  useLocation.mockReturnValue({
    pathname: '/dashboard',
    search: '',
    hash: '',
    state: undefined,
  });
  window.history.pushState({}, 'Test page', '/pcs/dashboard');

  setup();
  await openActionsDropdown();
  userEvent.click(screen.getByText('Enter fullscreen'));

  expect(mockHistoryReplace).toHaveBeenCalledWith(
    expect.not.stringMatching(/^\/pcs\//),
  );
  expect(mockHistoryReplace).toHaveBeenCalledWith(
    expect.stringMatching(/^\/dashboard\?standalone=1$/),
  );
});

test('share URL should use browser-absolute pathname to preserve subdirectory prefix', () => {
  const { useLocation } = jest.requireMock('react-router-dom');
  // Router returns path without the subdirectory prefix
  useLocation.mockReturnValue({
    pathname: '/dashboard',
    search: '',
    hash: '',
    state: undefined,
  });
  // Browser URL includes the full prefix
  window.history.pushState({}, 'Test page', '/pcs/dashboard');

  const { container } = setup();
  // The share/embed URL must use window.location.pathname so that shared links
  // include the subdirectory prefix and work outside the React Router context.
  const emailLink = container.querySelector('[data-test="share-by-email"]');
  if (emailLink) {
    expect(emailLink.getAttribute('href')).toMatch(/\/pcs\/dashboard/);
  }
});
