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
import { shallow } from 'enzyme';
import sinon from 'sinon';
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { HeaderDropdownProps } from 'src/dashboard/components/Header/types';
import injectCustomCss from 'src/dashboard/util/injectCustomCss';
import { FeatureFlag } from '@superset-ui/core';
import * as uiCore from '@superset-ui/core';
import HeaderActionsDropdown from '.';

let isFeatureEnabledMock: jest.MockInstance<boolean, [feature: FeatureFlag]>;

const createProps = () => ({
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
  dataMask: {},
  logEvent: jest.fn(),
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

function setup(props: HeaderDropdownProps) {
  return render(
    <div className="dashboard-header">
      <HeaderActionsDropdown {...props} />
    </div>,
    { useRedux: true },
  );
}

fetchMock.get('glob:*/csstemplateasyncmodelview/api/read', {});

test('should render', () => {
  const mockedProps = createProps();
  const { container } = setup(mockedProps);
  expect(container).toBeInTheDocument();
});

test('should render the Download dropdown button when not in edit mode', () => {
  const mockedProps = createProps();
  setup(mockedProps);
  expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
});

test('should render the menu items', async () => {
  const mockedProps = createProps();
  setup(mockedProps);
  expect(screen.getAllByRole('menuitem')).toHaveLength(4);
  expect(screen.getByText('Refresh dashboard')).toBeInTheDocument();
  expect(screen.getByText('Set auto-refresh interval')).toBeInTheDocument();
  expect(screen.getByText('Enter fullscreen')).toBeInTheDocument();
  expect(screen.getByText('Download')).toBeInTheDocument();
});

test('should render the menu items in edit mode', async () => {
  setup(editModeOnProps);
  expect(screen.getAllByRole('menuitem')).toHaveLength(5);
  expect(screen.getByText('Set auto-refresh interval')).toBeInTheDocument();
  expect(screen.getByText('Edit properties')).toBeInTheDocument();
  expect(screen.getByText('Edit CSS')).toBeInTheDocument();
  expect(screen.getByText('Download')).toBeInTheDocument();
});

describe('with native filters feature flag disabled', () => {
  beforeAll(() => {
    isFeatureEnabledMock = jest
      .spyOn(uiCore, 'isFeatureEnabled')
      .mockImplementation(
        (featureFlag: FeatureFlag) =>
          featureFlag !== FeatureFlag.DASHBOARD_NATIVE_FILTERS,
      );
  });

  afterAll(() => {
    // @ts-ignore
    isFeatureEnabledMock.restore();
  });

  it('should render filter mapping in edit mode if explicit filter scopes undefined', async () => {
    setup(editModeOnProps);
    expect(screen.getByText('Set filter mapping')).toBeInTheDocument();
  });

  it('should render filter mapping in edit mode if explicit filter scopes defined', async () => {
    setup(editModeOnWithFilterScopesProps);
    expect(screen.getByText('Set filter mapping')).toBeInTheDocument();
  });
});

describe('with native filters feature flag enabled', () => {
  beforeAll(() => {
    isFeatureEnabledMock = jest
      .spyOn(uiCore, 'isFeatureEnabled')
      .mockImplementation(
        (featureFlag: FeatureFlag) =>
          featureFlag === FeatureFlag.DASHBOARD_NATIVE_FILTERS,
      );
  });

  afterAll(() => {
    // @ts-ignore
    isFeatureEnabledMock.restore();
  });

  it('should not render filter mapping in edit mode if explicit filter scopes undefined', async () => {
    setup(editModeOnProps);
    expect(screen.queryByText('Set filter mapping')).not.toBeInTheDocument();
  });

  it('should render filter mapping in edit mode if explicit filter scopes defined', async () => {
    setup(editModeOnWithFilterScopesProps);
    expect(screen.getByText('Set filter mapping')).toBeInTheDocument();
  });
});

test('should show the share actions', async () => {
  const mockedProps = createProps();
  const canShareProps = {
    ...mockedProps,
    userCanShare: true,
  };
  setup(canShareProps);

  expect(screen.getByText('Share')).toBeInTheDocument();
});

test('should render the "Save as" menu item when user can save', async () => {
  const mockedProps = createProps();
  const canSaveProps = {
    ...mockedProps,
    userCanSave: true,
  };
  setup(canSaveProps);
  expect(screen.getByText('Save as')).toBeInTheDocument();
});

test('should NOT render the "Save as" menu item when user cannot save', async () => {
  const mockedProps = createProps();
  setup(mockedProps);
  expect(screen.queryByText('Save as')).not.toBeInTheDocument();
});

test('should render the "Refresh dashboard" menu item as disabled when loading', async () => {
  const mockedProps = createProps();
  const loadingProps = {
    ...mockedProps,
    isLoading: true,
  };
  setup(loadingProps);
  expect(screen.getByText('Refresh dashboard')).toHaveClass(
    'ant-menu-item-disabled',
  );
});

test('should NOT render the "Refresh dashboard" menu item as disabled', async () => {
  const mockedProps = createProps();
  setup(mockedProps);
  expect(screen.getByText('Refresh dashboard')).not.toHaveClass(
    'ant-menu-item-disabled',
  );
});

test('should render with custom css', () => {
  const mockedProps = createProps();
  const { customCss } = mockedProps;
  setup(mockedProps);
  injectCustomCss(customCss);
  expect(screen.getByTestId('header-actions-menu')).toHaveStyle(
    'margin-left: 100px',
  );
});

test('should refresh the charts', async () => {
  const mockedProps = createProps();
  setup(mockedProps);
  userEvent.click(screen.getByText('Refresh dashboard'));
  expect(mockedProps.forceRefreshAllCharts).toHaveBeenCalledTimes(1);
  expect(mockedProps.addSuccessToast).toHaveBeenCalledTimes(1);
});

test('should show the properties modal', async () => {
  setup(editModeOnProps);
  userEvent.click(screen.getByText('Edit properties'));
  expect(editModeOnProps.showPropertiesModal).toHaveBeenCalledTimes(1);
});

describe('UNSAFE_componentWillReceiveProps', () => {
  let wrapper: any;
  const mockedProps = createProps();
  const props = { ...mockedProps, customCss: '' };

  beforeEach(() => {
    wrapper = shallow(<HeaderActionsDropdown {...props} />);
    wrapper.setState({ css: props.customCss });
    sinon.spy(wrapper.instance(), 'setState');
  });

  afterEach(() => {
    wrapper.instance().setState.restore();
  });

  it('css should update state and inject custom css', () => {
    wrapper.instance().UNSAFE_componentWillReceiveProps({
      ...props,
      customCss: mockedProps.customCss,
    });
    expect(wrapper.instance().setState.calledOnce).toBe(true);
    const stateKeys = Object.keys(wrapper.instance().setState.lastCall.args[0]);
    expect(stateKeys).toContain('css');
  });
});
