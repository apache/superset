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
  isUserWithPermissionsAndRoles,
  UndefinedUser,
  UserWithPermissionsAndRoles,
} from 'src/types/bootstrapTypes';
import { Dashboard } from 'src/types/Dashboard';
import Subject from 'src/types/Subject';
import { findPermission } from 'src/utils/findPermission';
import getBootstrapData from 'src/utils/getBootstrapData';

const bootstrapData = getBootstrapData();
const ADMIN_ROLE_NAME = bootstrapData.common?.conf?.AUTH_ROLE_ADMIN || 'Admin';

const getUserSubjects = (): number[] =>
  getBootstrapData()?.common?.user_subjects ?? [];

/**
 * Editor lists arrive either as full Subjects (`editors`) or as bare subject
 * ids (`extra_editors`, which the API dumps straight from
 * `get_extra_editor_subject_ids`).
 */
export type SubjectRef = number | { id: number };

const subjectId = (subject: SubjectRef): number =>
  typeof subject === 'number' ? subject : subject.id;

/**
 * Whether the viewer is any of the given subjects — their user, roles or
 * groups — across every supplied list.
 */
export const isUserInSubjects = (
  ...subjectLists: (SubjectRef[] | null | undefined)[]
): boolean => {
  const userSubjects = getUserSubjects();
  return subjectLists.some(subjects =>
    (subjects ?? []).some(subject => userSubjects.includes(subjectId(subject))),
  );
};

const isUserInEditors = (editors: Subject[] = []): boolean =>
  isUserInSubjects(editors);

export const isUserAdmin = (
  user?: UserWithPermissionsAndRoles | UndefinedUser,
) =>
  isUserWithPermissionsAndRoles(user) &&
  Object.keys(user.roles || {}).some(
    role => role.toLowerCase() === ADMIN_ROLE_NAME.toLowerCase(),
  );

export const isUserEditorOrAdmin = (
  user?: UserWithPermissionsAndRoles | UndefinedUser,
  editors: Subject[] = [],
): boolean => isUserInEditors(editors) || isUserAdmin(user);

/**
 * Editorship of *dashboard*, matching the server's `is_editor`: the explicit
 * editor list unioned with any editorship granted indirectly by a
 * deployment's EXTRA_EDITORS_RESOLVER. Must stay in step with the server's
 * `is_editor` (security/manager.py): a predicate narrower than the server's
 * hides actions the API permits.
 */
export const isUserDashboardEditor = (dashboard: Dashboard): boolean =>
  isUserInSubjects(dashboard.editors, dashboard.extra_editors);

export const canUserEditDashboard = (
  dashboard: Dashboard,
  user?: UserWithPermissionsAndRoles | UndefinedUser | null,
) =>
  isUserWithPermissionsAndRoles(user) &&
  findPermission('can_write', 'Dashboard', user?.roles) &&
  (isUserAdmin(user) || isUserDashboardEditor(dashboard));

export function userHasPermission(
  user: UserWithPermissionsAndRoles | UndefinedUser,
  viewName: string,
  permissionName: string,
) {
  return (
    isUserAdmin(user) ||
    (isUserWithPermissionsAndRoles(user) &&
      Object.values(user.roles || {})
        .flat()
        .some(
          permissionView =>
            permissionView[0] === permissionName &&
            permissionView[1] === viewName,
        ))
  );
}

export const canUserSaveAsDashboard = (
  dashboard: Dashboard,
  user?: UserWithPermissionsAndRoles | UndefinedUser | null,
) =>
  isUserWithPermissionsAndRoles(user) &&
  findPermission('can_write', 'Dashboard', user?.roles) &&
  (isUserAdmin(user) || isUserDashboardEditor(dashboard));
