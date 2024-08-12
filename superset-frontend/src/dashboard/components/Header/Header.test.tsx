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
import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { getExtensionsRegistry } from '@superset-ui/core';
import setupExtensions from 'src/setup/setupExtensions';
import getOwnerName from 'src/utils/getOwnerName';
import { HeaderProps } from './types';
import Header from '.';

const createProps = () => ({
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
  addWarningToast: jest.fn(),
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
  reports: {},
  dashboardTitle: 'Dashboard Title',
  charts: {},
  layout: {},
  expandedSlices: {},
  css: '',
  customCss: '',
  isStarred: false,
  isLoading: false,
  lastModifiedTime: 0,
  refreshFrequency: 0,
  shouldPersistRefreshFrequency: false,
  onSave: jest.fn(),
  onChange: jest.fn(),
  fetchFaveStar: jest.fn(),
  fetchCharts: jest.fn(),
  onRefresh: jest.fn(),
  saveFaveStar: jest.fn(),
  savePublished: jest.fn(),
  isPublished: false,
  updateDashboardTitle: jest.fn(),
  editMode: false,
  setEditMode: jest.fn(),
  showBuilderPane: jest.fn(),
  updateCss: jest.fn(),
  setColorScheme: jest.fn(),
  setUnsavedChanges: jest.fn(),
  logEvent: jest.fn(),
  setRefreshFrequency: jest.fn(),
  hasUnsavedChanges: false,
  maxUndoHistoryExceeded: false,
  onUndo: jest.fn(),
  onRedo: jest.fn(),
  undoLength: 0,
  redoLength: 0,
  setMaxUndoHistoryExceeded: jest.fn(),
  maxUndoHistoryToast: jest.fn(),
  dashboardInfoChanged: jest.fn(),
  dashboardTitleChanged: jest.fn(),
  showMenuDropdown: true,
});
const props = createProps();
const editableProps = {
  ...props,
  editMode: true,
  dashboardInfo: {
    ...props.dashboardInfo,
    dash_edit_perm: true,
    dash_save_perm: true,
  },
};
const undoProps = {
  ...editableProps,
  undoLength: 1,
};
const redoProps = {
  ...editableProps,
  redoLength: 1,
};

fetchMock.get('glob:*/csstemplateasyncmodelview/api/read', {});

function setup(props: HeaderProps, initialState = {}) {
  return render(
    <div className="dashboard">
      <Header {...props} />
    </div>,
    { useRedux: true, initialState },
  );
}

async function openActionsDropdown() {
  const btn = screen.getByRole('img', { name: 'more-horiz' });
  userEvent.click(btn);
  expect(await screen.findByTestId('header-actions-menu')).toBeInTheDocument();
}

test('should render', () => {
  const mockedProps = createProps();
  const { container } = setup(mockedProps);
  expect(container).toBeInTheDocument();
});

test('should render the title', () => {
  const mockedProps = createProps();
  setup(mockedProps);
  expect(screen.getByTestId('editable-title')).toHaveTextContent(
    'Dashboard Title',
  );
});

test('should render the editable title', () => {
  setup(editableProps);
  expect(screen.getByDisplayValue('Dashboard Title')).toBeInTheDocument();
});

test('should edit the title', () => {
  setup(editableProps);
  const editableTitle = screen.getByDisplayValue('Dashboard Title');
  expect(editableProps.onChange).not.toHaveBeenCalled();
  userEvent.click(editableTitle);
  userEvent.clear(editableTitle);
  userEvent.type(editableTitle, 'New Title');
  userEvent.click(document.body);
  expect(editableProps.onChange).toHaveBeenCalled();
  expect(screen.getByDisplayValue('New Title')).toBeInTheDocument();
});

test('should render the "Draft" status', () => {
  const mockedProps = createProps();
  setup(mockedProps);
  expect(screen.getByText('Draft')).toBeInTheDocument();
});

test('should publish', () => {
  const mockedProps = createProps();
  const canEditProps = {
    ...mockedProps,
    dashboardInfo: {
      ...mockedProps.dashboardInfo,
      dash_edit_perm: true,
      dash_save_perm: true,
    },
  };
  setup(canEditProps);
  const draft = screen.getByText('Draft');
  expect(mockedProps.savePublished).toHaveBeenCalledTimes(0);
  userEvent.click(draft);
  expect(mockedProps.savePublished).toHaveBeenCalledTimes(1);
});

test('should render metadata', () => {
  const mockedProps = createProps();
  setup(mockedProps);
  expect(
    screen.getByText(getOwnerName(mockedProps.dashboardInfo.created_by)),
  ).toBeInTheDocument();
  expect(
    screen.getByText(mockedProps.dashboardInfo.changed_on_delta_humanized),
  ).toBeInTheDocument();
});

test('should render the "Undo" action as disabled', () => {
  setup(editableProps);
  expect(screen.getByTestId('undo-action').parentElement).toBeDisabled();
});

test('should undo', () => {
  setup(undoProps);
  const undo = screen.getByTestId('undo-action');
  expect(undoProps.onUndo).not.toHaveBeenCalled();
  userEvent.click(undo);
  expect(undoProps.onUndo).toHaveBeenCalledTimes(1);
});

test('should undo with key listener', () => {
  undoProps.onUndo.mockReset();
  setup(undoProps);
  expect(undoProps.onUndo).not.toHaveBeenCalled();
  fireEvent.keyDown(document.body, { key: 'z', code: 'KeyZ', ctrlKey: true });
  expect(undoProps.onUndo).toHaveBeenCalledTimes(1);
});

test('should render the "Redo" action as disabled', () => {
  setup(editableProps);
  expect(screen.getByTestId('redo-action').parentElement).toBeDisabled();
});

test('should redo', () => {
  setup(redoProps);
  const redo = screen.getByTestId('redo-action');
  expect(redoProps.onRedo).not.toHaveBeenCalled();
  userEvent.click(redo);
  expect(redoProps.onRedo).toHaveBeenCalledTimes(1);
});

test('should redo with key listener', () => {
  redoProps.onRedo.mockReset();
  setup(redoProps);
  expect(redoProps.onRedo).not.toHaveBeenCalled();
  fireEvent.keyDown(document.body, { key: 'y', code: 'KeyY', ctrlKey: true });
  expect(redoProps.onRedo).toHaveBeenCalledTimes(1);
});

test('should render the "Discard changes" button', () => {
  setup(editableProps);
  expect(screen.getByText('Discard')).toBeInTheDocument();
});

test('should render the "Save" button as disabled', () => {
  setup(editableProps);
  expect(screen.getByText('Save').parentElement).toBeDisabled();
});

test('should save', () => {
  const unsavedProps = {
    ...editableProps,
    hasUnsavedChanges: true,
  };
  setup(unsavedProps);
  const save = screen.getByText('Save');
  expect(unsavedProps.onSave).not.toHaveBeenCalled();
  userEvent.click(save);
  expect(unsavedProps.onSave).toHaveBeenCalledTimes(1);
});

test('should NOT render the "Draft" status', () => {
  const mockedProps = createProps();
  const publishedProps = {
    ...mockedProps,
    isPublished: true,
  };
  setup(publishedProps);
  expect(screen.queryByText('Draft')).not.toBeInTheDocument();
});

test('should render the unselected fave icon', () => {
  const mockedProps = createProps();
  setup(mockedProps);
  expect(mockedProps.fetchFaveStar).toHaveBeenCalled();
  expect(
    screen.getByRole('img', { name: 'favorite-unselected' }),
  ).toBeInTheDocument();
});

test('should render the selected fave icon', () => {
  const mockedProps = createProps();
  const favedProps = {
    ...mockedProps,
    isStarred: true,
  };
  setup(favedProps);
  expect(
    screen.getByRole('img', { name: 'favorite-selected' }),
  ).toBeInTheDocument();
});

test('should NOT render the fave icon on anonymous user', () => {
  const mockedProps = createProps();
  const anonymousUserProps = {
    ...mockedProps,
    user: undefined,
  };
  setup(anonymousUserProps);
  expect(() =>
    screen.getByRole('img', { name: 'favorite-unselected' }),
  ).toThrowError('Unable to find');
  expect(() =>
    screen.getByRole('img', { name: 'favorite-selected' }),
  ).toThrowError('Unable to find');
});

test('should fave', async () => {
  const mockedProps = createProps();
  setup(mockedProps);
  const fave = screen.getByRole('img', { name: 'favorite-unselected' });
  expect(mockedProps.saveFaveStar).not.toHaveBeenCalled();
  userEvent.click(fave);
  expect(mockedProps.saveFaveStar).toHaveBeenCalledTimes(1);
});

test('should toggle the edit mode', () => {
  const mockedProps = createProps();
  const canEditProps = {
    ...mockedProps,
    dashboardInfo: {
      ...mockedProps.dashboardInfo,
      dash_edit_perm: true,
    },
  };
  setup(canEditProps);
  const editDashboard = screen.getByText('Edit dashboard');
  expect(screen.queryByText('Edit dashboard')).toBeInTheDocument();
  userEvent.click(editDashboard);
  expect(mockedProps.logEvent).toHaveBeenCalled();
});

test('should render the dropdown icon', () => {
  const mockedProps = createProps();
  setup(mockedProps);
  expect(screen.getByRole('img', { name: 'more-horiz' })).toBeInTheDocument();
});

test('should refresh the charts', async () => {
  const mockedProps = createProps();
  setup(mockedProps);
  await openActionsDropdown();
  userEvent.click(screen.getByText('Refresh dashboard'));
  expect(mockedProps.onRefresh).toHaveBeenCalledTimes(1);
});

test('should render an extension component if one is supplied', () => {
  const extensionsRegistry = getExtensionsRegistry();
  extensionsRegistry.set('dashboard.nav.right', () => (
    <>dashboard.nav.right extension component</>
  ));
  setupExtensions();

  const mockedProps = createProps();
  setup(mockedProps);
  expect(
    screen.getByText('dashboard.nav.right extension component'),
  ).toBeInTheDocument();
});
