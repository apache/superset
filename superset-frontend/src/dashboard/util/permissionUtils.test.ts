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
import Owner from 'src/types/Owner';
import {
  canUserAccessSqlLab,
  canUserEditDashboard,
  isUserAdmin,
} from './permissionUtils';

const ownerUser: UserWithPermissionsAndRoles = {
  createdOn: '2021-05-12T16:56:22.116839',
  email: 'user@example.com',
  firstName: 'Test',
  isActive: true,
  isAnonymous: false,
  lastName: 'User',
  userId: 1,
  username: 'owner',
  permissions: {},
  roles: { Alpha: [['can_write', 'Dashboard']] },
};

const adminUser: UserWithPermissionsAndRoles = {
  ...ownerUser,
  roles: {
    ...(ownerUser?.roles || {}),
    Admin: [['can_write', 'Dashboard']],
  },
  userId: 2,
  username: 'admin',
};

const outsiderUser: UserWithPermissionsAndRoles = {
  ...ownerUser,
  userId: 3,
  username: 'outsider',
};

const owner: Owner = {
  first_name: 'Test',
  id: ownerUser.userId!,
  last_name: 'User',
};

const sqlLabUser: UserWithPermissionsAndRoles = {
  ...ownerUser,
  roles: {
    ...ownerUser.roles,
    sql_lab: [],
  },
};

const undefinedUser: UndefinedUser = {};

describe('canUserEditDashboard', () => {
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
    owners: [owner],
    roles: [],
  };

  it('allows owners to edit', () => {
    expect(canUserEditDashboard(dashboard, ownerUser)).toEqual(true);
  });
  it('allows admin users to edit regardless of ownership', () => {
    expect(canUserEditDashboard(dashboard, adminUser)).toEqual(true);
  });
  it('rejects non-owners', () => {
    expect(canUserEditDashboard(dashboard, outsiderUser)).toEqual(false);
  });
  it('rejects nonexistent users', () => {
    expect(canUserEditDashboard(dashboard, null)).toEqual(false);
  });
  it('rejects missing roles', () => {
    // in redux, when there is no user, the user is actually set to an empty object,
    // so we need to handle missing roles as well as a missing user.s
    expect(canUserEditDashboard(dashboard, {})).toEqual(false);
  });
  it('rejects "admins" if the admin role does not have edit rights for some reason', () => {
    expect(
      canUserEditDashboard(dashboard, {
        ...adminUser,
        roles: { Admin: [] },
      }),
    ).toEqual(false);
  });
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
  expect(isUserAdmin(ownerUser)).toEqual(false);
});

test('canUserAccessSqlLab returns true for admin user', () => {
  expect(canUserAccessSqlLab(adminUser)).toEqual(true);
});

test('canUserAccessSqlLab returns false for undefined', () => {
  expect(canUserAccessSqlLab(undefined)).toEqual(false);
});

test('canUserAccessSqlLab returns false for undefined user', () => {
  expect(canUserAccessSqlLab(undefinedUser)).toEqual(false);
});

test('canUserAccessSqlLab returns false for non-sqllab role', () => {
  expect(canUserAccessSqlLab(ownerUser)).toEqual(false);
});

test('canUserAccessSqlLab returns true for sqllab role', () => {
  expect(canUserAccessSqlLab(sqlLabUser)).toEqual(true);
});
