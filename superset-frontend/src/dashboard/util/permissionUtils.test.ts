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
import {
  UndefinedUser,
  UserWithPermissionsAndRoles,
} from 'src/types/bootstrapTypes';
import { Dashboard } from 'src/types/Dashboard';
import User from 'src/types/User';
import Subject from 'src/types/Subject';
import {
  userHasPermission,
  canUserEditDashboard,
  canUserSaveAsDashboard,
  isUserAdmin,
  isUserDashboardEditor,
} from './permissionUtils';

const editorUser: UserWithPermissionsAndRoles = {
  createdOn: '2021-05-12T16:56:22.116839',
  email: 'user@example.com',
  firstName: 'Test',
  isActive: true,
  isAnonymous: false,
  lastName: 'User',
  userId: 1,
  username: 'editor',
  permissions: {},
  roles: { Alpha: [['can_write', 'Dashboard']] },
};

const adminUser: UserWithPermissionsAndRoles = {
  ...editorUser,
  roles: {
    ...editorUser?.roles,
    Admin: [['can_write', 'Dashboard']],
  },
  userId: 2,
  username: 'admin',
};

const outsiderUser: UserWithPermissionsAndRoles = {
  ...editorUser,
  userId: 3,
  username: 'outsider',
};

const owner: User = {
  first_name: 'Test',
  id: editorUser.userId!,
  last_name: 'User',
};

const editorSubject: Subject = {
  id: 10,
  label: 'Test User Subject',
  type: 1,
};

const sqlLabMenuAccessPermission: [string, string] = ['menu_access', 'SQL Lab'];

const arbitraryPermissions: [string, string][] = [
  ['can_write', 'AnArbitraryView'],
  sqlLabMenuAccessPermission,
];

const sqlLabUser: UserWithPermissionsAndRoles = {
  ...editorUser,
  roles: {
    ...editorUser.roles,
    sql_lab: [sqlLabMenuAccessPermission],
  },
};

const undefinedUser: UndefinedUser = {};

const dashboard: Dashboard = {
  id: 1,
  dashboard_title: 'Test Dash',
  url: 'https://dashboard.example.com/1',
  thumbnail_url: 'https://dashboard.example.com/1/thumbnail.png',
  published: true,
  css: null,
  changed_by_name: 'Test User',
  changed_by: owner,
  changed_on: '2021-05-12T16:56:22.116839',
  charts: [],
  roles: [],
  editors: [editorSubject],
  viewers: [],
};

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    common: {
      user_subjects: [10],
    },
  })),
}));

test('isUserDashboardEditor returns true when user is in editors subjects', () => {
  expect(isUserDashboardEditor(dashboard)).toEqual(true);
});

test('isUserDashboardEditor returns false when user is not in editors subjects', () => {
  const dashWithoutEditor = {
    ...dashboard,
    editors: [{ id: 999, label: 'Other', type: 1 }],
  };
  expect(isUserDashboardEditor(dashWithoutEditor)).toEqual(false);
});

test('isUserDashboardEditor returns false when editors is empty', () => {
  const dashNoEditors = { ...dashboard, editors: [] };
  expect(isUserDashboardEditor(dashNoEditors)).toEqual(false);
});

test('canUserEditDashboard allows editors', () => {
  expect(canUserEditDashboard(dashboard, editorUser)).toEqual(true);
});

test('canUserEditDashboard allows admins', () => {
  expect(canUserEditDashboard(dashboard, adminUser)).toEqual(true);
});

test('canUserEditDashboard rejects non-editors', () => {
  const dashNoEditor = {
    ...dashboard,
    editors: [{ id: 999, label: 'Other', type: 1 }],
  };
  expect(canUserEditDashboard(dashNoEditor, outsiderUser)).toEqual(false);
});

test('canUserEditDashboard rejects nonexistent users', () => {
  expect(canUserEditDashboard(dashboard, null)).toEqual(false);
});

test('canUserEditDashboard rejects missing roles', () => {
  expect(canUserEditDashboard(dashboard, {})).toEqual(false);
});

test('canUserEditDashboard rejects admins without write permission', () => {
  expect(
    canUserEditDashboard(dashboard, {
      ...adminUser,
      roles: { Admin: [] },
    }),
  ).toEqual(false);
});

test('canUserSaveAsDashboard allows editors', () => {
  expect(canUserSaveAsDashboard(dashboard, editorUser)).toEqual(true);
});

test('canUserSaveAsDashboard allows admins', () => {
  expect(canUserSaveAsDashboard(dashboard, adminUser)).toEqual(true);
});

test('canUserSaveAsDashboard rejects non-editors', () => {
  const dashNoEditor = {
    ...dashboard,
    editors: [{ id: 999, label: 'Other', type: 1 }],
  };
  expect(canUserSaveAsDashboard(dashNoEditor, outsiderUser)).toEqual(false);
});

test('isUserAdmin returns true for admin user', () => {
  expect(isUserAdmin(adminUser)).toEqual(true);
});

test('isUserAdmin returns false for undefined', () => {
  expect(isUserAdmin(undefined)).toEqual(false);
});

test('isUserAdmin returns false for undefined user', () => {
  expect(isUserAdmin(undefinedUser)).toEqual(false);
});

test('isUserAdmin returns false for non-admin user', () => {
  expect(isUserAdmin(editorUser)).toEqual(false);
});

test('userHasPermission always returns true for admin user', () => {
  arbitraryPermissions.forEach(permissionView => {
    expect(
      userHasPermission(adminUser, permissionView[1], permissionView[0]),
    ).toEqual(true);
  });
});

test('userHasPermission always returns false for undefined user', () => {
  arbitraryPermissions.forEach(permissionView => {
    expect(
      userHasPermission(undefinedUser, permissionView[1], permissionView[0]),
    ).toEqual(false);
  });
});

test('userHasPermission returns false if user does not have permission', () => {
  expect(
    userHasPermission(
      editorUser,
      sqlLabMenuAccessPermission[1],
      sqlLabMenuAccessPermission[0],
    ),
  ).toEqual(false);
});

test('userHasPermission returns true if user has permission', () => {
  expect(
    userHasPermission(
      sqlLabUser,
      sqlLabMenuAccessPermission[1],
      sqlLabMenuAccessPermission[0],
    ),
  ).toEqual(true);
});
