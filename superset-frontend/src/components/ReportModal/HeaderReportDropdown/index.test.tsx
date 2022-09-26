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
import * as React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen, act } from 'spec/helpers/testing-library';
import * as featureFlags from '@superset-ui/core';
import HeaderReportDropdown, { HeaderReportProps } from '.';

let isFeatureEnabledMock: jest.MockInstance<boolean, [string]>;

jest.mock('src/components/Icons/Icon', () => () => <span />);

const createProps = () => ({
  dashboardId: 1,
  useTextMenu: false,
  isDropdownVisible: false,
  setIsDropdownVisible: jest.fn,
  setShowReportSubMenu: jest.fn,
});

const stateWithOnlyUser = {
  user: {
    email: 'admin@test.com',
    firstName: 'admin',
    isActive: true,
    lastName: 'admin',
    permissions: {},
    createdOn: '2022-01-12T10:17:37.801361',
    roles: { Admin: [['menu_access', 'Manage']] },
    userId: 1,
    username: 'admin',
  },
  reports: {},
};

const stateWithUserAndReport = {
  user: {
    email: 'admin@test.com',
    firstName: 'admin',
    isActive: true,
    lastName: 'admin',
    permissions: {},
    createdOn: '2022-01-12T10:17:37.801361',
    roles: { Admin: [['menu_access', 'Manage']] },
    userId: 1,
    username: 'admin',
  },
  reports: {
    dashboards: {
      1: {
        id: 1,
        result: {
          active: true,
          creation_method: 'dashboards',
          crontab: '0 12 * * 1',
          dashboard: 1,
          name: 'Weekly Report',
          owners: [1],
          recipients: [
            {
              recipient_config_json: {
                target: 'admin@test.com',
              },
              type: 'Email',
            },
          ],
          type: 'Report',
        },
      },
    },
  },
};

function setup(props: HeaderReportProps, initialState = {}) {
  render(
    <div>
      <HeaderReportDropdown {...props} />
    </div>,
    { useRedux: true, initialState },
  );
}

describe('Header Report Dropdown', () => {
  beforeAll(() => {
    isFeatureEnabledMock = jest
      .spyOn(featureFlags, 'isFeatureEnabled')
      .mockImplementation(
        (featureFlag: featureFlags.FeatureFlag) =>
          featureFlag === featureFlags.FeatureFlag.ALERT_REPORTS,
      );
  });

  afterAll(() => {
    // @ts-ignore
    isFeatureEnabledMock.restore();
  });

  it('renders correctly', () => {
    const mockedProps = createProps();
    act(() => {
      setup(mockedProps, stateWithUserAndReport);
    });
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders the dropdown correctly', () => {
    const mockedProps = createProps();
    act(() => {
      setup(mockedProps, stateWithUserAndReport);
    });
    const emailReportModalButton = screen.getByRole('button');
    userEvent.click(emailReportModalButton);
    expect(screen.getByText('Email reports active')).toBeInTheDocument();
    expect(screen.getByText('Edit email report')).toBeInTheDocument();
    expect(screen.getByText('Delete email report')).toBeInTheDocument();
  });

  it('opens an edit modal', async () => {
    const mockedProps = createProps();
    act(() => {
      setup(mockedProps, stateWithUserAndReport);
    });
    const emailReportModalButton = screen.getByRole('button');
    userEvent.click(emailReportModalButton);
    const editModal = screen.getByText('Edit email report');
    userEvent.click(editModal);
    const textBoxes = await screen.findAllByText('Edit email report');
    expect(textBoxes).toHaveLength(2);
  });

  it('opens a delete modal', () => {
    const mockedProps = createProps();
    act(() => {
      setup(mockedProps, stateWithUserAndReport);
    });
    const emailReportModalButton = screen.getByRole('button');
    userEvent.click(emailReportModalButton);
    const deleteModal = screen.getByText('Delete email report');
    userEvent.click(deleteModal);
    expect(screen.getByText('Delete Report?')).toBeInTheDocument();
  });

  it('renders a new report modal if there is no report', () => {
    const mockedProps = createProps();
    act(() => {
      setup(mockedProps, stateWithOnlyUser);
    });
    const emailReportModalButton = screen.getByRole('button');
    userEvent.click(emailReportModalButton);
    expect(screen.getByText('Schedule a new email report')).toBeInTheDocument();
  });

  it('renders Manage Email Reports Menu if textMenu is set to true and there is a report', () => {
    let mockedProps = createProps();
    mockedProps = {
      ...mockedProps,
      useTextMenu: true,
      isDropdownVisible: true,
    };
    act(() => {
      setup(mockedProps, stateWithUserAndReport);
    });
    expect(screen.getByText('Email reports active')).toBeInTheDocument();
    expect(screen.getByText('Edit email report')).toBeInTheDocument();
    expect(screen.getByText('Delete email report')).toBeInTheDocument();
  });

  it('renders Schedule Email Reports if textMenu is set to true and there is a report', () => {
    let mockedProps = createProps();
    mockedProps = {
      ...mockedProps,
      useTextMenu: true,
      isDropdownVisible: true,
    };
    act(() => {
      setup(mockedProps, stateWithOnlyUser);
    });
    expect(screen.getByText('Set up an email report')).toBeInTheDocument();
  });
});
