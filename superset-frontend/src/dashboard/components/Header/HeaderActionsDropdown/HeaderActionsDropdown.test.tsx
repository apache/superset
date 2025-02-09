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
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom'; // Changed from '@testing-library/jest-dom/extend-expect'
import fetchMock from 'fetch-mock';
import { HeaderDropdownProps } from 'src/dashboard/components/Header/types';
import injectCustomCss from 'src/dashboard/util/injectCustomCss';
import { HeaderActionsDropdown } from '.';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ThemeProvider, supersetTheme } from '@superset-ui/core';

const mockStore = configureStore({
  reducer: {
    dashboardState: (state = { directPathToChild: [] }) => state,
    reports: (state = { dashboards: {} }) => state, // Add reports reducer
  },
});

const createProps = (): HeaderDropdownProps => ({
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
  customCss: '.ant-menu {margin-left: 100px;}',
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
  userCanCurate: false,
  lastModifiedTime: 0,
  isDropdownVisible: true,
  setIsDropdownVisible: jest.fn(),
  directPathToChild: [],
  manageEmbedded: jest.fn(),
  dataMask: {},
  logEvent: jest.fn(),
  refreshLimit: 0,
  refreshWarning: '',
});

const editModeOnProps = {
  ...createProps(),
  editMode: true,
};

const editModeOnWithFilterScopesProps = {
  ...editModeOnProps,
  dashboardInfo: {
    ...editModeOnProps.dashboardInfo,
    metadata: {
      filter_scopes: {
        '1': { scopes: ['ROOT_ID'], immune: [] },
      },
    },
  },
};

const guestUserProps = {
  ...createProps(),
  dashboardInfo: {
    ...createProps().dashboardInfo,
    userId: undefined,
  },
};

function setup(props: HeaderDropdownProps) {
  return render(
    <Provider store={mockStore}>
      <ThemeProvider theme={supersetTheme}>
        <div className="dashboard-header">
          <HeaderActionsDropdown {...props} />
        </div>
      </ThemeProvider>
    </Provider>,
  );
}

fetchMock.get('glob:*/csstemplateasyncmodelview/api/read', {});

describe('HeaderActionsDropdown', () => {
  beforeEach(() => {
    fetchMock.resetHistory();
  });

  it('should render', () => {
    const mockedProps = createProps();
    const { container } = setup(mockedProps);
    expect(container).toBeInTheDocument();
  });

  it('should render the Download dropdown button when not in edit mode', () => {
    const mockedProps = createProps();
    setup(mockedProps);
    expect(
      screen.getByRole('menuitem', { name: 'Download' }),
    ).toBeInTheDocument();
  });

  it('should render the menu items', () => {
    const mockedProps = createProps();
    setup(mockedProps);
    expect(screen.getAllByRole('menuitem')).toHaveLength(4);
    expect(screen.getByText('Refresh dashboard')).toBeInTheDocument();
    expect(screen.getByText('Set auto-refresh interval')).toBeInTheDocument();
    expect(screen.getByText('Enter fullscreen')).toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
  });

  it('should render the menu items in edit mode', () => {
    setup(editModeOnProps);
    expect(screen.getAllByRole('menuitem')).toHaveLength(4);
    expect(screen.getByText('Set auto-refresh interval')).toBeInTheDocument();
    expect(screen.getByText('Edit properties')).toBeInTheDocument();
    expect(screen.getByText('Edit CSS')).toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
  });

  it('should render the menu items in Embedded mode', () => {
    setup(guestUserProps);
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
    expect(screen.getByText('Refresh dashboard')).toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
    expect(screen.getByText('Set auto-refresh interval')).toBeInTheDocument();
  });

  it('should not render filter mapping in edit mode if explicit filter scopes undefined', () => {
    setup(editModeOnProps);
    expect(screen.queryByText('Set filter mapping')).not.toBeInTheDocument();
  });

  it('should render filter mapping in edit mode if explicit filter scopes defined', () => {
    setup(editModeOnWithFilterScopesProps);
    expect(screen.getByText('Set filter mapping')).toBeInTheDocument();
  });

  it('should show the share actions when user can share', () => {
    const mockedProps = createProps();
    setup({ ...mockedProps, userCanShare: true });
    expect(screen.getByText('Share')).toBeInTheDocument();
  });

  it('should render the "Save as" menu item when user can save', () => {
    const mockedProps = createProps();
    setup({ ...mockedProps, userCanSave: true });
    expect(screen.getByText('Save as')).toBeInTheDocument();
  });

  it('should NOT render the "Save as" menu item when user cannot save', () => {
    setup(createProps());
    expect(screen.queryByText('Save as')).not.toBeInTheDocument();
  });

  it('should render the "Refresh dashboard" menu item as disabled when loading', () => {
    const mockedProps = createProps();
    setup({ ...mockedProps, isLoading: true });
    expect(
      screen.getByText('Refresh dashboard').closest('.ant-menu-item'),
    ).toHaveClass('ant-menu-item-disabled');
  });

  it('should NOT render the "Refresh dashboard" menu item as disabled when not loading', () => {
    setup(createProps());
    expect(
      screen.getByText('Refresh dashboard').closest('.ant-menu-item'),
    ).not.toHaveClass('ant-menu-item-disabled');
  });

  it('should render with custom css', () => {
    const mockedProps = createProps();
    setup(mockedProps);
    injectCustomCss(mockedProps.customCss);
    expect(screen.getByTestId('header-actions-menu')).toHaveStyle({
      marginLeft: '100px',
    });
  });

  it('should refresh the charts when clicking refresh', async () => {
    const mockedProps = createProps();
    setup(mockedProps);
    await userEvent.click(screen.getByText('Refresh dashboard'));
    expect(mockedProps.forceRefreshAllCharts).toHaveBeenCalledTimes(1);
    expect(mockedProps.addSuccessToast).toHaveBeenCalledTimes(1);
  });

  it('should show the properties modal when clicking edit properties', async () => {
    setup(editModeOnProps);
    await userEvent.click(screen.getByText('Edit properties'));
    expect(editModeOnProps.showPropertiesModal).toHaveBeenCalledTimes(1);
  });

  it('should update css when props change', async () => {
    const mockedProps = createProps();
    const { rerender } = setup({ ...mockedProps, customCss: '' });

    // Update props with new CSS
    rerender(
      <Provider store={mockStore}>
        <ThemeProvider theme={supersetTheme}>
          <div className="dashboard-header">
            <HeaderActionsDropdown
              {...mockedProps}
              customCss={mockedProps.customCss}
            />
          </div>
        </ThemeProvider>
      </Provider>,
    );

    expect(screen.getByTestId('header-actions-menu')).toHaveStyle({
      marginLeft: '100px',
    });
  });
});
