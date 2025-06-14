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
import { act, render, screen, userEvent } from 'spec/helpers/testing-library';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import HeaderReportDropdown, { HeaderReportProps } from '.';

const createProps = () => ({
  dashboardId: 1,
  useTextMenu: false,
  setShowReportSubMenu: jest.fn,
  showReportModal: jest.fn,
  setCurrentReportDeleting: jest.fn,
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

const stateWithNonAdminUser = {
  user: {
    email: 'nonadmin@test.com',
    firstName: 'nonadmin',
    isActive: true,
    lastName: 'nonadmin',
    permissions: {},
    createdOn: '2022-01-12T10:17:37.801361',
    roles: {
      Gamme: [['no_menu_access', 'Manage']],
      OtherRole: [['menu_access', 'Manage']],
    },
    userId: 1,
    username: 'nonadmin',
  },
  reports: {},
};

const stateWithNonMenuAccessOnManage = {
  user: {
    email: 'nonaccess@test.com',
    firstName: 'nonaccess',
    isActive: true,
    lastName: 'nonaccess',
    permissions: {},
    createdOn: '2022-01-12T10:17:37.801361',
    roles: { Gamma: [['no_menu_access', 'Manage']] },
    userId: 1,
    username: 'nonaccess',
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
    <Menu>
      <HeaderReportDropdown {...props} />
    </Menu>,
    { useRedux: true, initialState },
  );
}

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockedIsFeatureEnabled = isFeatureEnabled as jest.Mock;

describe('Header Report Dropdown', () => {
  beforeAll(() => {
    mockedIsFeatureEnabled.mockImplementation(
      (featureFlag: FeatureFlag) => featureFlag === FeatureFlag.AlertReports,
    );
  });

  afterAll(() => {
    mockedIsFeatureEnabled.mockRestore();
  });

  it('renders correctly', () => {
    const mockedProps = createProps();
    act(() => {
      setup(mockedProps, stateWithUserAndReport);
    });
    expect(screen.getByRole('menuitem')).toBeInTheDocument();
  });

  it('renders the dropdown correctly', async () => {
    const mockedProps = createProps();
    act(() => {
      setup(mockedProps, stateWithUserAndReport);
    });
    const emailReportModalButton = screen.getByRole('menuitem');
    userEvent.hover(emailReportModalButton);
    expect(await screen.findByText('Email reports active')).toBeInTheDocument();
    expect(screen.getByText('Edit email report')).toBeInTheDocument();
    expect(screen.getByText('Delete email report')).toBeInTheDocument();
  });

  it('opens an edit modal', async () => {
    const mockedProps = createProps();
    mockedProps.showReportModal = jest.fn();
    act(() => {
      setup(mockedProps, stateWithUserAndReport);
    });
    const emailReportModalButton = screen.getByRole('menuitem');
    userEvent.click(emailReportModalButton);
    const editModal = await screen.findByText('Edit email report');
    userEvent.click(editModal);
    expect(mockedProps.showReportModal).toHaveBeenCalled();
  });

  it('opens a delete modal', async () => {
    const mockedProps = createProps();
    mockedProps.setCurrentReportDeleting = jest.fn();
    act(() => {
      setup(mockedProps, stateWithUserAndReport);
    });
    const emailReportModalButton = screen.getByRole('menuitem');
    userEvent.click(emailReportModalButton);
    const deleteModal = await screen.findByText('Delete email report');
    userEvent.click(deleteModal);
    expect(mockedProps.setCurrentReportDeleting).toHaveBeenCalled();
  });

  it('renders Manage Email Reports Menu if textMenu is set to true and there is a report', async () => {
    let mockedProps = createProps();
    mockedProps = {
      ...mockedProps,
      useTextMenu: true,
    };
    act(() => {
      setup(mockedProps, stateWithUserAndReport);
    });
    userEvent.click(screen.getByRole('menuitem'));
    expect(await screen.findByText('Email reports active')).toBeInTheDocument();
    expect(screen.getByText('Edit email report')).toBeInTheDocument();
    expect(screen.getByText('Delete email report')).toBeInTheDocument();
  });

  it('renders Schedule Email Reports if textMenu is set to true and there is a report', async () => {
    let mockedProps = createProps();
    mockedProps = {
      ...mockedProps,
      useTextMenu: true,
    };
    act(() => {
      setup(mockedProps, stateWithOnlyUser);
    });
    userEvent.click(screen.getByRole('menuitem'));
    expect(
      await screen.findByText('Set up an email report'),
    ).toBeInTheDocument();
  });

  it('renders Schedule Email Reports as long as user has permission through any role', async () => {
    let mockedProps = createProps();
    mockedProps = {
      ...mockedProps,
      useTextMenu: true,
    };
    act(() => {
      setup(mockedProps, stateWithNonAdminUser);
    });
    userEvent.click(screen.getByRole('menuitem'));
    expect(
      await screen.findByText('Set up an email report'),
    ).toBeInTheDocument();
  });

  it('do not render Schedule Email Reports if user no permission', () => {
    let mockedProps = createProps();
    mockedProps = {
      ...mockedProps,
      useTextMenu: true,
    };
    act(() => {
      setup(mockedProps, stateWithNonMenuAccessOnManage);
    });

    userEvent.click(screen.getByRole('menu'));
    expect(
      screen.queryByText('Set up an email report'),
    ).not.toBeInTheDocument();
  });
});
