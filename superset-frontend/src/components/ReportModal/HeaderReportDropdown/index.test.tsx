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
import * as featureFlags from 'src/featureFlags';
import { FeatureFlag } from '@superset-ui/core';
import HeaderReportDropdown, { HeaderReportProps } from '.';

let isFeatureEnabledMock: jest.MockInstance<boolean, [string]>;

const createProps = () => ({
  toggleActive: jest.fn(),
  deleteActiveReport: jest.fn(),
  dashboardId: 1,
});

const stateWithOnlyUser = {
  explore: {
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
  },
  reports: {},
};

const stateWithUserAndReport = {
  explore: {
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
        (featureFlag: FeatureFlag) => featureFlag === FeatureFlag.ALERT_REPORTS,
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

  it('opens an edit modal', () => {
    const mockedProps = createProps();
    act(() => {
      setup(mockedProps, stateWithUserAndReport);
    });
    const emailReportModalButton = screen.getByRole('button');
    userEvent.click(emailReportModalButton);
    const editModal = screen.getByText('Edit email report');
    userEvent.click(editModal);
    expect(screen.getByText('Edit Email Report')).toBeInTheDocument();
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
    expect(screen.getByText('New Email Report')).toBeInTheDocument();
  });
});
