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
  isUserEditorOrAdmin,
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
  groups: [],
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

const editor: User = {
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
  changed_by: editor,
  changed_on: '2021-05-12T16:56:22.116839',
  charts: [],
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

test('isUserDashboardEditor counts editorship granted through extra_editors', () => {
  // The server's is_editor unions EXTRA_EDITORS_RESOLVER output into the
  // editor set, and the API attaches it after the response schema is dumped
  // (so it survives the columns projection). extra_editors arrives as bare
  // ids, not Subjects.
  const dashExtraEditor = { ...dashboard, editors: [], extra_editors: [10] };
  expect(isUserDashboardEditor(dashExtraEditor)).toEqual(true);
  expect(canUserEditDashboard(dashExtraEditor, editorUser)).toEqual(true);
});

test('isUserDashboardEditor unions the two lists rather than preferring one', () => {
  // Pins the union semantics: a refactor that consulted extra_editors only
  // when editors is empty would pass the empty-editors cases above but
  // fail here — non-matching editors must not mask a matching extra grant.
  const dashUnion = {
    ...dashboard,
    editors: [{ id: 999, label: 'Other', type: 1 }],
    extra_editors: [10],
  };
  expect(isUserDashboardEditor(dashUnion)).toEqual(true);
});

test('an empty extra_editors grants nothing on its own', () => {
  // The resolver-configured-but-returns-nothing shape.
  const dashEmptyExtra = { ...dashboard, editors: [], extra_editors: [] };
  expect(isUserDashboardEditor(dashEmptyExtra)).toEqual(false);
});

test('isUserDashboardEditor ignores extra_editors for other subjects', () => {
  const dashOtherExtraEditor = {
    ...dashboard,
    editors: [],
    extra_editors: [999],
  };
  expect(isUserDashboardEditor(dashOtherExtraEditor)).toEqual(false);
  expect(canUserEditDashboard(dashOtherExtraEditor, editorUser)).toEqual(false);
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

describe('isUserEditorOrAdmin', () => {
  test('returns true when the user is a subject editor', () => {
    expect(isUserEditorOrAdmin(editorUser, [editorSubject])).toEqual(true);
  });

  test('returns true when the user is an admin, regardless of subject membership', () => {
    const nonMatchingSubject: Subject = { id: 999, label: 'Other', type: 1 };
    expect(isUserEditorOrAdmin(adminUser, [nonMatchingSubject])).toEqual(true);
  });

  test('returns false when the user is neither a subject editor nor an admin', () => {
    const nonMatchingSubject: Subject = { id: 999, label: 'Other', type: 1 };
    expect(isUserEditorOrAdmin(outsiderUser, [nonMatchingSubject])).toEqual(
      false,
    );
  });

  test('returns false when editors is empty', () => {
    expect(isUserEditorOrAdmin(editorUser, [])).toEqual(false);
  });

  test('returns false when editors is omitted', () => {
    expect(isUserEditorOrAdmin(outsiderUser)).toEqual(false);
  });

  test('returns true when the user is granted editorship only through extra_editors', () => {
    expect(isUserEditorOrAdmin(editorUser, [], [10])).toEqual(true);
  });

  test('unions editors and extra_editors rather than preferring one', () => {
    const nonMatchingSubject: Subject = { id: 999, label: 'Other', type: 1 };
    expect(isUserEditorOrAdmin(editorUser, [nonMatchingSubject], [10])).toEqual(
      true,
    );
  });

  test('returns false when extra_editors names other subjects', () => {
    expect(isUserEditorOrAdmin(editorUser, [], [999])).toEqual(false);
  });
});

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('isUserAdmin with a custom AUTH_ROLE_ADMIN', () => {
  // The file-level `jest.mock('src/utils/getBootstrapData', ...)` above
  // permanently stubs out getBootstrapData with fixed data, which would
  // shadow the DOM-driven bootstrap data these tests set up. Unmock it so
  // the re-imported permissionUtils picks up the real implementation
  // (reading document.getElementById('app')), then restore the mock
  // afterward so later tests in this file keep their expected stub.
  beforeEach(() => {
    jest.unmock('src/utils/getBootstrapData');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.resetModules();
    jest.mock('src/utils/getBootstrapData', () => ({
      __esModule: true,
      default: jest.fn(() => ({
        common: {
          user_subjects: [10],
        },
      })),
    }));
  });

  test('recognizes a user in the configured custom admin role', async () => {
    document.body.innerHTML =
      '<div id="app" data-bootstrap=\'{"common":{"conf":{"AUTH_ROLE_ADMIN":"SuperAdmin"}}}\'></div>';

    jest.resetModules();
    const { isUserAdmin: isUserAdminWithCustomRole } =
      await import('./permissionUtils');

    expect(
      isUserAdminWithCustomRole({
        username: 'super-admin',
        permissions: {},
        roles: { SuperAdmin: [['can_write', 'Dashboard']] },
      }),
    ).toEqual(true);
  });

  test('does not throw and falls back to the default role when bootstrap data has no conf', async () => {
    document.body.innerHTML =
      '<div id="app" data-bootstrap=\'{"common":{}}\'></div>';

    jest.resetModules();
    const { isUserAdmin: isUserAdminWithoutConf } =
      await import('./permissionUtils');

    expect(isUserAdminWithoutConf(adminUser)).toEqual(true);
  });
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
