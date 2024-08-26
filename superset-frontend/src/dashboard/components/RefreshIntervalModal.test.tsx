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
import { isValidElement } from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';

import RefreshIntervalModal from 'src/dashboard/components/RefreshIntervalModal';
import { HeaderActionsDropdown } from 'src/dashboard/components/Header/HeaderActionsDropdown';

const createProps = () => ({
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
  customCss:
    '.header-with-actions .right-button-panel .ant-dropdown-trigger{margin-left: 100px;}',
  dashboardId: 1,
  dashboardInfo: {
    id: 1,
    dash_edit_perm: true,
    dash_save_perm: true,
    userId: '1',
    metadata: {},
    common: {
      conf: {
        DASHBOARD_AUTO_REFRESH_INTERVALS: [
          [0, "Don't refresh"],
          [10, '10 seconds'],
          [30, '30 seconds'],
          [60, '1 minute'],
          [300, '5 minutes'],
          [1800, '30 minutes'],
          [3600, '1 hour'],
          [21600, '6 hours'],
          [43200, '12 hours'],
          [86400, '24 hours'],
        ],
      },
    },
  },
  dashboardTitle: 'Title',
  editMode: false,
  expandedSlices: {},
  forceRefreshAllCharts: jest.fn(),
  hasUnsavedChanges: false,
  isLoading: false,
  layout: {},
  dataMask: {},
  onChange: jest.fn(),
  onSave: jest.fn(),
  refreshFrequency: 0,
  setRefreshFrequency: jest.fn(),
  shouldPersistRefreshFrequency: false,
  showPropertiesModal: jest.fn(),
  startPeriodicRender: jest.fn(),
  updateCss: jest.fn(),
  userCanEdit: false,
  userCanSave: false,
  userCanShare: false,
  lastModifiedTime: 0,
  isDropdownVisible: true,
});

const editModeOnProps = {
  ...createProps(),
  editMode: true,
};

const setup = (overrides?: any) => (
  <div className="dashboard-header">
    <HeaderActionsDropdown {...editModeOnProps} {...overrides} />
  </div>
);

fetchMock.get('glob:*/csstemplateasyncmodelview/api/read', {});

const openRefreshIntervalModal = async () => {
  const autoRefreshOption = screen.getByText('Set auto-refresh interval');
  userEvent.click(autoRefreshOption);
};

const displayOptions = async () => {
  // Click default refresh interval option to display other options
  userEvent.click(screen.getByText(/don't refresh/i));
};

const defaultRefreshIntervalModalProps = {
  triggerNode: <i className="fa fa-edit" />,
  refreshFrequency: 0,
  onChange: jest.fn(),
  editMode: true,
  addSuccessToast: jest.fn(),
  refreshIntervalOptions: [],
};

test('is valid', () => {
  expect(
    isValidElement(
      <RefreshIntervalModal {...defaultRefreshIntervalModalProps} />,
    ),
  ).toBe(true);
});

test('renders refresh interval modal', async () => {
  render(setup(editModeOnProps));
  await openRefreshIntervalModal();

  // Assert that modal exists by checking for the modal title
  expect(screen.getByText('Refresh interval')).toBeVisible();
});

test('renders refresh interval options', async () => {
  render(setup(editModeOnProps));
  await openRefreshIntervalModal();
  await displayOptions();

  // Assert that both "Don't refresh" instances exist
  // - There will be two at this point, the default option and the dropdown option
  const dontRefreshInstances = screen.getAllByText(/don't refresh/i);
  expect(dontRefreshInstances).toHaveLength(2);
  dontRefreshInstances.forEach(option => {
    expect(option).toBeInTheDocument();
  });

  // Assert that all the other options exist
  const options = [
    screen.getByText(/10 seconds/i),
    screen.getByText(/30 seconds/i),
    screen.getByText(/1 minute/i),
    screen.getByText(/5 minutes/i),
    screen.getByText(/30 minutes/i),
    screen.getByText(/1 hour/i),
    screen.getByText(/6 hours/i),
    screen.getByText(/12 hours/i),
    screen.getByText(/24 hours/i),
  ];
  options.forEach(option => {
    expect(option).toBeInTheDocument();
  });
});

test('should change selected value', async () => {
  render(setup(editModeOnProps));
  await openRefreshIntervalModal();

  // Initial selected value should be "Don't refresh"
  const selectedValue = screen.getByText(/don't refresh/i);
  expect(selectedValue.title).toMatch(/don't refresh/i);

  // Display options and select "10 seconds"
  await displayOptions();
  userEvent.click(screen.getByText(/10 seconds/i));

  // Selected value should now be "10 seconds"
  expect(selectedValue.title).toMatch(/10 seconds/i);
  expect(selectedValue.title).not.toMatch(/don't refresh/i);
});

test('should change selected value to custom value', async () => {
  render(setup(editModeOnProps));
  await openRefreshIntervalModal();

  // Initial selected value should be "Don't refresh"
  const selectedValue = screen.getByText(/don't refresh/i);
  expect(selectedValue.title).toMatch(/don't refresh/i);

  // Display options and select "Custom interval"
  await displayOptions();
  userEvent.click(screen.getByText(/Custom interval/i));

  // Selected value should now be "Custom interval"
  expect(selectedValue.title).toMatch(/Custom interval/i);
  expect(selectedValue.title).not.toMatch(/don't refresh/i);
});

test('should save a newly-selected value', async () => {
  render(setup(editModeOnProps));
  await openRefreshIntervalModal();
  await displayOptions();

  // Select a new interval and click save
  userEvent.click(screen.getByText(/10 seconds/i));
  userEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(editModeOnProps.setRefreshFrequency).toHaveBeenCalled();
  expect(editModeOnProps.setRefreshFrequency).toHaveBeenCalledWith(
    10,
    editModeOnProps.editMode,
  );
  expect(editModeOnProps.addSuccessToast).toHaveBeenCalled();
});

test('should show warning message', async () => {
  const warningProps = {
    ...editModeOnProps,
    refreshLimit: 3600,
    refreshWarning: 'Show warning',
  };

  const { getByRole, queryByRole } = render(setup(warningProps));
  await openRefreshIntervalModal();
  await displayOptions();

  userEvent.click(screen.getByText(/30 seconds/i));
  expect(getByRole('alert')).toBeInTheDocument();
  userEvent.click(screen.getByText(/6 hours/i));
  expect(queryByRole('alert')).not.toBeInTheDocument();
});
