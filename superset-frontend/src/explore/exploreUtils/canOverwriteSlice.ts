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
  isUserAdmin,
  isUserInSubjects,
  type SubjectRef,
} from 'src/dashboard/util/permissionUtils';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';

interface SliceLike {
  editors?: SubjectRef[] | null;
  extra_editors?: SubjectRef[] | null;
  is_managed_externally?: boolean | null;
}

/**
 * Whether *user* may modify *slice*, in the sense that governs both saving
 * over a chart and acting on its version history.
 *
 * `canOverwrite` is the value the explore store holds, which `hydrateExplore`
 * computes purely as "the current user is among the slice's editors". That is
 * necessary but not sufficient: a chart with no explicit editors — which
 * includes every seeded and example chart — yields false for everyone,
 * administrators included. So the store value is treated as one of several
 * routes to permission rather than the whole answer.
 *
 * Externally managed slices are excluded: their source of truth lives outside
 * Superset, so overwriting or reverting one would be overwritten again by the
 * next sync.
 */
export function canOverwriteSlice({
  slice,
  user,
  canOverwrite = false,
}: {
  slice?: SliceLike | null;
  user?: UserWithPermissionsAndRoles;
  canOverwrite?: boolean;
}): boolean {
  if (!slice || slice.is_managed_externally) {
    return false;
  }
  if (canOverwrite || isUserAdmin(user)) {
    return true;
  }

  // Editors are Subjects — the viewer's user, roles and groups — so compare
  // against subject ids rather than the user id. `extra_editors` carries
  // editorship granted indirectly by a deployment's EXTRA_EDITORS_RESOLVER;
  // the server counts it, so leaving it out here would hide the action from
  // someone the API would happily let through.
  return isUserInSubjects(slice.editors, slice.extra_editors);
}

export default canOverwriteSlice;
