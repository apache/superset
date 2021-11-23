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
import { mount } from 'enzyme';
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';

import ModalTrigger from 'src/components/ModalTrigger';
import RefreshIntervalModal from 'src/dashboard/components/RefreshIntervalModal';
import HeaderActionsDropdown from 'src/dashboard/components/Header/HeaderActionsDropdown';
import Alert from 'src/components/Alert';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';

describe('RefreshIntervalModal - Enzyme', () => {
  const getMountWrapper = (props: any) =>
    mount(<RefreshIntervalModal {...props} />, {
      wrappingComponent: ThemeProvider,
      wrappingComponentProps: {
        theme: supersetTheme,
      },
    });
  const mockedProps = {
    triggerNode: <i className="fa fa-edit" />,
    refreshFrequency: 10,
    onChange: jest.fn(),
    editMode: true,
  };
  it('should show warning message', () => {
    const props = {
      ...mockedProps,
      refreshLimit: 3600,
      refreshWarning: 'Show warning',
    };

    const wrapper = getMountWrapper(props);
    wrapper.find('span[role="button"]').simulate('click');

    // @ts-ignore (for handleFrequencyChange)
    wrapper.instance().handleFrequencyChange(30);
    wrapper.update();
    expect(wrapper.find(ModalTrigger).find(Alert)).toExist();

    // @ts-ignore (for handleFrequencyChange)
    wrapper.instance().handleFrequencyChange(3601);
    wrapper.update();
    expect(wrapper.find(ModalTrigger).find(Alert)).not.toExist();
    wrapper.unmount();
  });
});

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
  const headerActionsButton = screen.getByRole('img', { name: 'more-horiz' });
  userEvent.click(headerActionsButton);

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
};

describe('RefreshIntervalModal - RTL', () => {
  it('is valid', () => {
    expect(
      React.isValidElement(
        <RefreshIntervalModal {...defaultRefreshIntervalModalProps} />,
      ),
    ).toBe(true);
  });

  it('renders refresh interval modal', async () => {
    render(setup(editModeOnProps));
    await openRefreshIntervalModal();

    // Assert that modal exists by checking for the modal title
    expect(screen.getByText('Refresh interval')).toBeVisible();
  });

  it('renders refresh interval options', async () => {
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

  it('should change selected value', async () => {
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

  it('should save a newly-selected value', async () => {
    render(setup(editModeOnProps));
    await openRefreshIntervalModal();
    await displayOptions();

    screen.logTestingPlaygroundURL();
    // Select a new interval and click save
    userEvent.click(screen.getByText(/10 seconds/i));
    userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(editModeOnProps.setRefreshFrequency).toHaveBeenCalled();
    expect(editModeOnProps.setRefreshFrequency).toHaveBeenCalledWith(
      10,
      editModeOnProps.editMode,
    );
  });

  it('should show warning message', async () => {
    // TODO (lyndsiWilliams): This test is incomplete
    const warningProps = {
      ...editModeOnProps,
      refreshLimit: 3600,
      refreshWarning: 'Show warning',
    };

    render(setup(warningProps));
    await openRefreshIntervalModal();
    await displayOptions();

    userEvent.click(screen.getByText(/30 seconds/i));
    userEvent.click(screen.getByRole('button', { name: /save/i }));

    // screen.debug(screen.getByRole('alert'));
    expect.anything();
  });
});
