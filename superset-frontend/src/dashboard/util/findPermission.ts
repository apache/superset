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
import memoizeOne from 'memoize-one';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import Dashboard from 'src/types/Dashboard';

type UserRoles = Record<string, [string, string][]>;

const findPermission = memoizeOne(
  (perm: string, view: string, roles?: UserRoles | null) =>
    !!roles &&
    Object.values(roles).some(permissions =>
      permissions.some(([perm_, view_]) => perm_ === perm && view_ === view),
    ),
);

export default findPermission;

// this should really be a config value,
// but is hardcoded in backend logic already, so...
const ADMIN_ROLE_NAME = 'admin';

const isUserAdmin = (user: UserWithPermissionsAndRoles) =>
  Object.keys(user.roles).some(role => role.toLowerCase() === ADMIN_ROLE_NAME);

const isUserDashboardOwner = (
  dashboard: Dashboard,
  user: UserWithPermissionsAndRoles,
) => dashboard.owners.some(owner => owner.username === user.username);

export const canUserEditDashboard = (
  dashboard: Dashboard,
  user?: UserWithPermissionsAndRoles | null,
) =>
  !!user?.roles &&
  (isUserAdmin(user) || isUserDashboardOwner(dashboard, user)) &&
  findPermission('can_write', 'Dashboard', user.roles);
