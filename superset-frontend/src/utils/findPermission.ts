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
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { UserRoles } from 'src/types/bootstrapTypes';

export const findPermission = memoizeOne(
  (perm: string, view: string, roles?: UserRoles | null) =>
    !!roles &&
    Object.values(roles).some(permissions =>
      permissions.some(([perm_, view_]) => perm_ === perm && view_ === view),
    ),
);

/**
 * Whether the user may download chart data (CSV, Excel). Mirrors what the
 * backend enforces: with GranularExportControls enabled it checks the granular
 * can_export_data permission, otherwise can_csv. The same shape as
 * hydrateExplore and usePermissions, so the download button never shows for a
 * user the backend would 403.
 */
export const canDownloadData = (roles?: UserRoles | null): boolean =>
  isFeatureEnabled(FeatureFlag.GranularExportControls)
    ? findPermission('can_export_data', 'Superset', roles)
    : findPermission('can_csv', 'Superset', roles);
