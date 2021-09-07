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
import React from 'react';
import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
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
    userId: 1,
    metadata: {},
    common: {
      conf: {},
    },
  },
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
  saveFaveStar: jest.fn(),
  savePublished: jest.fn(),
  isPublished: false,
  updateDashboardTitle: jest.fn(),
  editMode: false,
  setEditMode: jest.fn(),
  showBuilderPane: jest.fn(),
  updateCss: jest.fn(),
  setColorSchemeAndUnsavedChanges: jest.fn(),
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

function setup(props: HeaderProps) {
  return (
    <div className="dashboard">
      <Header {...props} />
    </div>
  );
}

async function openActionsDropdown() {
  const btn = screen.getByRole('img', { name: 'more-horiz' });
  userEvent.click(btn);
  expect(await screen.findByRole('menu')).toBeInTheDocument();
}

test('should render', () => {
  const mockedProps = createProps();
  const { container } = render(setup(mockedProps));
  expect(container).toBeInTheDocument();
});

test('should render the title', () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  expect(screen.getByText('Dashboard Title')).toBeInTheDocument();
});

test('should render the editable title', () => {
  render(setup(editableProps));
  expect(screen.getByDisplayValue('Dashboard Title')).toBeInTheDocument();
});

test('should edit the title', () => {
  render(setup(editableProps));
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
  render(setup(mockedProps));
  expect(screen.getByText('Draft')).toBeInTheDocument();
});

test('should publish', () => {
  render(setup(editableProps));
  const draft = screen.getByText('Draft');
  expect(editableProps.savePublished).not.toHaveBeenCalled();
  userEvent.click(draft);
  expect(editableProps.savePublished).toHaveBeenCalledTimes(1);
});

test('should render the "Undo" action as disabled', () => {
  render(setup(editableProps));
  expect(screen.getByTitle('Undo').parentElement).toBeDisabled();
});

test('should undo', () => {
  render(setup(undoProps));
  const undo = screen.getByTitle('Undo');
  expect(undoProps.onUndo).not.toHaveBeenCalled();
  userEvent.click(undo);
  expect(undoProps.onUndo).toHaveBeenCalledTimes(1);
});

test('should undo with key listener', () => {
  undoProps.onUndo.mockReset();
  render(setup(undoProps));
  expect(undoProps.onUndo).not.toHaveBeenCalled();
  fireEvent.keyDown(document.body, { key: 'z', code: 'KeyZ', ctrlKey: true });
  expect(undoProps.onUndo).toHaveBeenCalledTimes(1);
});

test('should render the "Redo" action as disabled', () => {
  render(setup(editableProps));
  expect(screen.getByTitle('Redo').parentElement).toBeDisabled();
});

test('should redo', () => {
  render(setup(redoProps));
  const redo = screen.getByTitle('Redo');
  expect(redoProps.onRedo).not.toHaveBeenCalled();
  userEvent.click(redo);
  expect(redoProps.onRedo).toHaveBeenCalledTimes(1);
});

test('should redo with key listener', () => {
  redoProps.onRedo.mockReset();
  render(setup(redoProps));
  expect(redoProps.onRedo).not.toHaveBeenCalled();
  fireEvent.keyDown(document.body, { key: 'y', code: 'KeyY', ctrlKey: true });
  expect(redoProps.onRedo).toHaveBeenCalledTimes(1);
});

test('should render the "Discard changes" button', () => {
  render(setup(editableProps));
  expect(screen.getByText('Discard changes')).toBeInTheDocument();
});

test('should render the "Save" button as disabled', () => {
  render(setup(editableProps));
  expect(screen.getByText('Save').parentElement).toBeDisabled();
});

test('should save', () => {
  const unsavedProps = {
    ...editableProps,
    hasUnsavedChanges: true,
  };
  render(setup(unsavedProps));
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
  render(setup(publishedProps));
  expect(screen.queryByText('Draft')).not.toBeInTheDocument();
});

test('should render the unselected fave icon', () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
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
  render(setup(favedProps));
  expect(
    screen.getByRole('img', { name: 'favorite-selected' }),
  ).toBeInTheDocument();
});

test('should fave', async () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
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
  render(setup(canEditProps));
  const editDashboard = screen.getByTitle('Edit dashboard');
  expect(screen.queryByTitle('Edit dashboard')).toBeInTheDocument();
  userEvent.click(editDashboard);
  expect(mockedProps.logEvent).toHaveBeenCalled();
});

test('should render the dropdown icon', () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  expect(screen.getByRole('img', { name: 'more-horiz' })).toBeInTheDocument();
});

test('should refresh the charts', async () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  await openActionsDropdown();
  userEvent.click(screen.getByText('Refresh dashboard'));
  expect(mockedProps.fetchCharts).toHaveBeenCalledTimes(1);
});
