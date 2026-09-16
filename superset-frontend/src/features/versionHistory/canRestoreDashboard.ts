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
import type { RootState } from 'src/dashboard/types';

/**
 * Whether the current user may restore a version of this dashboard.
 *
 * The dashboard counterpart of `canOverwriteSlice`, and it excludes
 * externally managed dashboards for the same reason: their source of truth
 * lives outside Superset, so a restore would be overwritten again by the next
 * sync.
 *
 * Exported as one selector because the gate has more than one consumer — the
 * history panel and the preview banner — and the header menu's own
 * `is_managed_externally` check already showed how easily those drift apart.
 * The panel is reachable directly via `?version_history=true`, so a gate
 * applied only where the menu entry renders is not applied at all. The restore
 * endpoint checks editorship but not external management, which leaves this as
 * the only guard.
 */
export const selectCanRestoreDashboard = (state: RootState): boolean =>
  (state.dashboardInfo?.dash_edit_perm ?? false) &&
  !state.dashboardInfo?.is_managed_externally;

export default selectCanRestoreDashboard;
