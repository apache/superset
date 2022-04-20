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
import { HeaderDropdownProps } from 'src/dashboard/components/Header/types';
import injectCustomCss from 'src/dashboard/util/injectCustomCss';
import HeaderActionsDropdown from '.';

const createProps = () => ({
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
  customCss: '#save-dash-split-button{margin-left: 100px;}',
  dashboardId: 1,
  dashboardInfo: {
    id: 1,
    dash_edit_perm: true,
    dash_save_perm: true,
    userId: '1',
    metadata: {},
    common: {
      conf: {},
    },
  },
  dashboardTitle: 'Title',
  editMode: false,
  expandedSlices: {},
  forceRefreshAllCharts: jest.fn(),
  hasUnsavedChanges: false,
  isLoading: false,
  layout: {},
  onChange: jest.fn(),
  onSave: jest.fn(),
  refreshFrequency: 200,
  setRefreshFrequency: jest.fn(),
  shouldPersistRefreshFrequency: false,
  showPropertiesModal: jest.fn(),
  startPeriodicRender: jest.fn(),
  updateCss: jest.fn(),
  userCanEdit: false,
  userCanSave: false,
  userCanShare: false,
  lastModifiedTime: 0,
});
const editModeOnProps = {
  ...createProps(),
  editMode: true,
};

function setup(props: HeaderDropdownProps) {
  return (
    <div className="dashboard-header">
      <HeaderActionsDropdown {...props} />
    </div>
  );
}

fetchMock.get('glob:*/csstemplateasyncmodelview/api/read', {});

async function openDropdown() {
  const btn = screen.getByRole('img', { name: 'more-horiz' });
  userEvent.click(btn);
  expect(await screen.findByRole('menu')).toBeInTheDocument();
}

test('should render', () => {
  const mockedProps = createProps();
  const { container } = render(setup(mockedProps));
  expect(container).toBeInTheDocument();
});

test('should render the dropdown button', () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  expect(screen.getByRole('button')).toBeInTheDocument();
});

test('should render the dropdown icon', () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  expect(screen.getByRole('img', { name: 'more-horiz' })).toBeInTheDocument();
});

test('should open the dropdown', async () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  await openDropdown();
  expect(await screen.findByRole('menu')).toBeInTheDocument();
});

test('should render the menu items', async () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  await openDropdown();
  expect(screen.getAllByRole('menuitem')).toHaveLength(4);
  expect(screen.getByText('Refresh dashboard')).toBeInTheDocument();
  expect(screen.getByText('Set auto-refresh interval')).toBeInTheDocument();
  expect(screen.getByText('Download as image')).toBeInTheDocument();
  expect(screen.getByText('Enter fullscreen')).toBeInTheDocument();
});

test('should render the menu items in edit mode', async () => {
  render(setup(editModeOnProps));
  await openDropdown();
  expect(screen.getAllByRole('menuitem')).toHaveLength(5);
  expect(screen.getByText('Refresh dashboard')).toBeInTheDocument();
  expect(screen.getByText('Set auto-refresh interval')).toBeInTheDocument();
  expect(screen.getByText('Set filter mapping')).toBeInTheDocument();
  expect(screen.getByText('Edit dashboard properties')).toBeInTheDocument();
  expect(screen.getByText('Edit CSS')).toBeInTheDocument();
});

test('should show the share actions', async () => {
  const mockedProps = createProps();
  const canShareProps = {
    ...mockedProps,
    userCanShare: true,
  };
  render(setup(canShareProps));
  await openDropdown();
  expect(screen.getByText('Copy permalink to clipboard')).toBeInTheDocument();
  expect(screen.getByText('Share permalink by email')).toBeInTheDocument();
});

test('should render the "Save Modal" when user can save', async () => {
  const mockedProps = createProps();
  const canSaveProps = {
    ...mockedProps,
    userCanSave: true,
  };
  render(setup(canSaveProps));
  await openDropdown();
  expect(screen.getByText('Save as')).toBeInTheDocument();
});

test('should NOT render the "Save Modal" menu item when user cannot save', async () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  await openDropdown();
  expect(screen.queryByText('Save as')).not.toBeInTheDocument();
});

test('should render the "Refresh dashboard" menu item as disabled when loading', async () => {
  const mockedProps = createProps();
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

test('should NOT render the "Refresh dashboard" menu item as disabled', async () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  await openDropdown();
  expect(screen.getByText('Refresh dashboard')).not.toHaveClass(
    'ant-dropdown-menu-item-disabled',
  );
});

test('should render with custom css', () => {
  const mockedProps = createProps();
  const { customCss } = mockedProps;
  render(setup(mockedProps));
  injectCustomCss(customCss);
  expect(screen.getByRole('button')).toHaveStyle('margin-left: 100px');
});

test('should refresh the charts', async () => {
  const mockedProps = createProps();
  render(setup(mockedProps));
  await openDropdown();
  userEvent.click(screen.getByText('Refresh dashboard'));
  expect(mockedProps.forceRefreshAllCharts).toHaveBeenCalledTimes(1);
  expect(mockedProps.addSuccessToast).toHaveBeenCalledTimes(1);
});

test('should show the properties modal', async () => {
  render(setup(editModeOnProps));
  await openDropdown();
  userEvent.click(screen.getByText('Edit dashboard properties'));
  expect(editModeOnProps.showPropertiesModal).toHaveBeenCalledTimes(1);
});
