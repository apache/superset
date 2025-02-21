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
import {
  render,
  screen,
  fireEvent,
  userEvent,
} from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import { getExtensionsRegistry, JsonObject } from '@superset-ui/core';
import setupExtensions from 'src/setup/setupExtensions';
import getOwnerName from 'src/utils/getOwnerName';
import Header from '.';
import { DASHBOARD_HEADER_ID } from '../../util/constants';

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

const undoState = {
  ...editableState,
  dashboardLayout: {
    ...initialState.dashboardLayout,
    past: [{}],
  },
};

const redoState = {
  ...editableState,
  dashboardLayout: {
    ...initialState.dashboardLayout,
    future: [{}],
  },
};

fetchMock.get('glob:*/csstemplateasyncmodelview/api/read', {});

function setup(overrideState: JsonObject = {}) {
  return render(
    <div className="dashboard">
      <Header />
    </div>,
    { useRedux: true, initialState: { ...initialState, ...overrideState } },
  );
}

async function openActionsDropdown() {
  const btn = screen.getByRole('img', { name: 'more-horiz' });
  userEvent.click(btn);
  expect(await screen.findByTestId('header-actions-menu')).toBeInTheDocument();
}

const addSuccessToast = jest.fn();
const addDangerToast = jest.fn();
const addWarningToast = jest.fn();
const onUndo = jest.fn();
const onRedo = jest.fn();
const setEditMode = jest.fn();
const setUnsavedChanges = jest.fn();
const fetchFaveStar = jest.fn();
const saveFaveStar = jest.fn();
const savePublished = jest.fn();
const fetchCharts = jest.fn();
const updateDashboardTitle = jest.fn();
const updateCss = jest.fn();
const onChange = jest.fn();
const onSave = jest.fn();
const setMaxUndoHistoryExceeded = jest.fn();
const maxUndoHistoryToast = jest.fn();
const logEvent = jest.fn();
const setRefreshFrequency = jest.fn();
const onRefresh = jest.fn();
const dashboardInfoChanged = jest.fn();
const dashboardTitleChanged = jest.fn();

beforeAll(() => {
  jest.spyOn(redux, 'bindActionCreators').mockImplementation(() => ({
    addSuccessToast,
    addDangerToast,
    addWarningToast,
    onUndo,
    onRedo,
    setEditMode,
    setUnsavedChanges,
    fetchFaveStar,
    saveFaveStar,
    savePublished,
    fetchCharts,
    updateDashboardTitle,
    updateCss,
    onChange,
    onSave,
    setMaxUndoHistoryExceeded,
    maxUndoHistoryToast,
    logEvent,
    setRefreshFrequency,
    onRefresh,
    dashboardInfoChanged,
    dashboardTitleChanged,
  }));
});

beforeEach(() => {
  jest.clearAllMocks();
});

test('should render', () => {
  const { container } = setup();
  expect(container).toBeInTheDocument();
});

test('should render the title', () => {
  setup();
  expect(screen.getByTestId('editable-title')).toHaveTextContent(
    'Dashboard Title',
  );
});

test('should render the editable title', () => {
  setup(editableState);
  expect(screen.getByDisplayValue('Dashboard Title')).toBeInTheDocument();
});

test('should edit the title', () => {
  setup(editableState);
  const editableTitle = screen.getByDisplayValue('Dashboard Title');
  expect(onChange).not.toHaveBeenCalled();
  userEvent.click(editableTitle);
  userEvent.clear(editableTitle);
  userEvent.type(editableTitle, 'New Title');
  userEvent.click(document.body);
  expect(onChange).toHaveBeenCalled();
  expect(screen.getByDisplayValue('New Title')).toBeInTheDocument();
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
  expect(savePublished).toHaveBeenCalledTimes(0);
  userEvent.click(draft);
  expect(savePublished).toHaveBeenCalledTimes(1);
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

test('should render the "Undo" action as disabled', () => {
  setup(editableState);
  expect(screen.getByTestId('undo-action').parentElement).toBeDisabled();
});

test('should undo', () => {
  setup(undoState);
  const undo = screen.getByTestId('undo-action');
  expect(onUndo).not.toHaveBeenCalled();
  userEvent.click(undo);
  expect(onUndo).toHaveBeenCalledTimes(1);
});

test('should undo with key listener', () => {
  onUndo.mockReset();
  setup(undoState);
  expect(onUndo).not.toHaveBeenCalled();
  fireEvent.keyDown(document.body, { key: 'z', code: 'KeyZ', ctrlKey: true });
  expect(onUndo).toHaveBeenCalledTimes(1);
});

test('should render the "Redo" action as disabled', () => {
  setup(editableState);
  expect(screen.getByTestId('redo-action').parentElement).toBeDisabled();
});

test('should redo', () => {
  setup(redoState);
  const redo = screen.getByTestId('redo-action');
  expect(onRedo).not.toHaveBeenCalled();
  userEvent.click(redo);
  expect(onRedo).toHaveBeenCalledTimes(1);
});

test('should redo with key listener', () => {
  setup(redoState);
  expect(onRedo).not.toHaveBeenCalled();
  fireEvent.keyDown(document.body, { key: 'y', code: 'KeyY', ctrlKey: true });
  expect(onRedo).toHaveBeenCalledTimes(1);
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
  const unsavedState = {
    ...editableState,
    dashboardState: {
      ...editableState.dashboardState,
      hasUnsavedChanges: true,
    },
  };
  setup(unsavedState);
  const save = screen.getByText('Save');
  expect(onSave).not.toHaveBeenCalled();
  userEvent.click(save);
  expect(onSave).toHaveBeenCalledTimes(1);
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
  expect(fetchFaveStar).toHaveBeenCalled();
  expect(
    screen.getByRole('img', { name: 'favorite-unselected' }),
  ).toBeInTheDocument();
});

test('should render the selected fave icon', () => {
  const favedState = {
    dashboardState: {
      ...initialState.dashboardState,
      isStarred: true,
    },
  };
  setup(favedState);
  expect(
    screen.getByRole('img', { name: 'favorite-selected' }),
  ).toBeInTheDocument();
});

test('should NOT render the fave icon on anonymous user', () => {
  const anonymousUserState = {
    user: undefined,
  };
  setup(anonymousUserState);
  expect(() =>
    screen.getByRole('img', { name: 'favorite-unselected' }),
  ).toThrow('Unable to find');
  expect(() => screen.getByRole('img', { name: 'favorite-selected' })).toThrow(
    'Unable to find',
  );
});

test('should fave', async () => {
  setup();
  const fave = screen.getByRole('img', { name: 'favorite-unselected' });
  expect(saveFaveStar).not.toHaveBeenCalled();
  userEvent.click(fave);
  expect(saveFaveStar).toHaveBeenCalledTimes(1);
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

test('should render the dropdown icon', () => {
  setup();
  expect(screen.getByRole('img', { name: 'more-horiz' })).toBeInTheDocument();
});

test('should refresh the charts', async () => {
  setup();
  await openActionsDropdown();
  userEvent.click(screen.getByText('Refresh dashboard'));
  expect(onRefresh).toHaveBeenCalledTimes(1);
});

test('should render an extension component if one is supplied', () => {
  const extensionsRegistry = getExtensionsRegistry();
  extensionsRegistry.set('dashboard.nav.right', () => (
    <>dashboard.nav.right extension component</>
  ));
  setupExtensions();

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
