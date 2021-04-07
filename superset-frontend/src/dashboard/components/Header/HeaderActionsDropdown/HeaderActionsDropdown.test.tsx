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
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import HeaderActionsDropdown from '.';

const mockedProps = {
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
  customCss: '#save-dash-split-button{margin-left: 100px;}',
  dashboardId: 1,
  dashboardInfo: {},
  dashboardTitle: 'Title',
  editMode: true,
  expandedSlices: {},
  filters: {},
  forceRefreshAllCharts: jest.fn(),
  hasUnsavedChanges: false,
  isLoading: false,
  layout: {},
  onChange: jest.fn(),
  onSave: jest.fn(),
  refreshFrequency: 200,
  setRefreshFrequency: jest.fn(),
  shouldPersistRefreshFrequency: true,
  showPropertiesModal: jest.fn(),
  startPeriodicRender: jest.fn(),
  updateCss: jest.fn(),
  userCanEdit: true,
  userCanSave: true,
  lastModifiedTime: 0,
};
const editModeOffProps = {
  ...mockedProps,
  editMode: false,
};

function setup(props: any) {
  return (
    <div className="dashboard">
      <HeaderActionsDropdown {...props} />
    </div>
  );
}

fetchMock.get('glob:*/csstemplateasyncmodelview/api/read', {});

async function openDropdown() {
  const btn = screen.getByRole('button');
  userEvent.click(btn);
  expect(await screen.findByRole('menu')).toBeInTheDocument();
}

test('should render', () => {
  const { container } = render(setup(mockedProps));
  expect(container).toBeInTheDocument();
});

test('should render the dropdown button', () => {
  render(setup(mockedProps));
  expect(screen.getByRole('button')).toBeInTheDocument();
});

test('should render the dropdown icon', () => {
  render(setup(mockedProps));
  expect(screen.getByRole('img', { name: 'more-horiz' })).toBeInTheDocument();
});

test('should open the dropdown', async () => {
  render(setup(mockedProps));
  await openDropdown();
  expect(await screen.findByRole('menu')).toBeInTheDocument();
});

test('should render the menu items in edit mode', async () => {
  render(setup(mockedProps));
  await openDropdown();
  expect(screen.getAllByRole('menuitem')).toHaveLength(8);
  expect(screen.getByText('Save as')).toBeInTheDocument();
  expect(screen.getByText('Copy dashboard URL')).toBeInTheDocument();
  expect(screen.getByText('Share dashboard by email')).toBeInTheDocument();
  expect(screen.getByText('Refresh dashboard')).toBeInTheDocument();
  expect(screen.getByText('Set auto-refresh interval')).toBeInTheDocument();
  expect(screen.getByText('Set filter mapping')).toBeInTheDocument();
  expect(screen.getByText('Edit dashboard properties')).toBeInTheDocument();
  expect(screen.getByText('Edit CSS')).toBeInTheDocument();
});

test('should render the menu items when not in edit mode', async () => {
  render(setup(editModeOffProps));
  await openDropdown();
  expect(screen.getAllByRole('menuitem')).toHaveLength(7);
  expect(screen.getByText('Save as')).toBeInTheDocument();
  expect(screen.getByText('Copy dashboard URL')).toBeInTheDocument();
  expect(screen.getByText('Share dashboard by email')).toBeInTheDocument();
  expect(screen.getByText('Refresh dashboard')).toBeInTheDocument();
  expect(screen.getByText('Set auto-refresh interval')).toBeInTheDocument();
  expect(screen.getByText('Download as image')).toBeInTheDocument();
  expect(screen.getByText('Toggle fullscreen')).toBeInTheDocument();
});

test('should render the "Save Modal" when user can save', async () => {
  render(setup(mockedProps));
  await openDropdown();
  expect(screen.getByText('Save as')).toBeInTheDocument();
});

test('should NOT render the "Save Modal" menu item when user cannot save', async () => {
  const cannotSaveProps = {
    ...mockedProps,
    userCanSave: false,
  };
  render(setup(cannotSaveProps));
  await openDropdown();
  expect(screen.queryByText('Save as')).not.toBeInTheDocument();
});

test('should render the "Refresh dashboard" menu item as disabled when loading', async () => {
  const loadingProps = {
    ...mockedProps,
    isLoading: true,
  };
  render(setup(loadingProps));
  await openDropdown();
  expect(screen.getByText('Refresh dashboard')).toHaveClass(
    'ant-dropdown-menu-item-disabled',
  );
});

test('should render with custom css', () => {
  render(setup(mockedProps));
  expect(screen.getByRole('button')).toHaveStyle('margin-left: 100px');
});

test('should refresh the charts', async () => {
  render(setup(mockedProps));
  await openDropdown();
  userEvent.click(screen.getByText('Refresh dashboard'));
  expect(mockedProps.forceRefreshAllCharts).toHaveBeenCalledTimes(1);
});

test('should show the properties modal', async () => {
  render(setup(mockedProps));
  await openDropdown();
  userEvent.click(screen.getByText('Edit dashboard properties'));
  expect(mockedProps.showPropertiesModal).toHaveBeenCalledTimes(1);
});
