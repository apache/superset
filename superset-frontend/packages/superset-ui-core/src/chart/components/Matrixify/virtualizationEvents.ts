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

/**
 * Mirrors FORCE_IN_VIEW_EVENT / RESTORE_VIRTUALIZATION_EVENT from
 * src/dashboard/constants.ts. Duplicated (rather than imported) because
 * packages/superset-ui-core cannot depend on app code under src/dashboard;
 * the string values must stay in sync with that file.
 *
 * Anything that lazily mounts a chart based on viewport visibility (e.g.
 * dashboard Row.tsx, MatrixifyGridCell) needs to listen for this event and
 * mount immediately when it fires, since client-side "Download as
 * Image/PDF" (see src/utils/downloadUtils.ts) dispatches it - optionally
 * scoped to a batch of dashboard row ids via `detail.rowIds` - to force
 * charts into view before capturing the page.
 */
export const FORCE_IN_VIEW_EVENT = 'superset-force-all-in-view';
export const RESTORE_VIRTUALIZATION_EVENT = 'superset-restore-virtualization';

/**
 * Module-level mirror of "which dashboard rows are currently forced into
 * view", in addition to the events themselves.
 *
 * Why this is needed: FORCE_IN_VIEW_EVENT is dispatched once per batch,
 * synchronously. A component that's already mounted when it fires (e.g.
 * dashboard Row.tsx, which stays mounted even when scrolled out of view)
 * can react to it directly via its own listener. But when
 * DASHBOARD_VIRTUALIZATION is on, a Row below the fold is unmounted
 * entirely, so forcing it into view causes it - and everything inside it,
 * including MatrixifyGridCell instances - to mount for the first time on a
 * later render. Those newly-mounted components register their event
 * listener in a passive effect that runs after the event has already been
 * dispatched and returned, so they would never see it. Tracking the
 * "currently forced" state at module scope lets a component read the
 * current state synchronously as soon as it mounts, regardless of whether
 * it existed yet when the event fired.
 *
 * - undefined: no force-in-view export is in progress.
 * - null: a force-in-view export is in progress and unscoped (every row).
 * - Set<string>: scoped to just these dashboard row ids, matching the
 *   batched dispatch in src/utils/downloadUtils.ts.
 */
let activeForceRowIds: Set<string> | null | undefined;

if (typeof window !== 'undefined') {
  window.addEventListener(FORCE_IN_VIEW_EVENT, event => {
    const rowIds = (event as CustomEvent<{ rowIds?: string[] }>).detail?.rowIds;
    activeForceRowIds = rowIds ? new Set(rowIds) : null;
  });
  window.addEventListener(RESTORE_VIRTUALIZATION_EVENT, () => {
    activeForceRowIds = undefined;
  });
}

/**
 * Whether a force-in-view export is currently active for the given ancestor
 * dashboard row id (or for content with no ancestor row at all, e.g. a
 * Matrixify chart rendered in Explore). Mirrors the scoping check dashboard
 * Row.tsx applies to the live event: an unscoped force (no `rowIds`) always
 * matches.
 */
export const isForceInViewActiveForRow = (rowId: string | null): boolean => {
  if (activeForceRowIds === undefined) return false;
  if (activeForceRowIds === null) return true;
  return rowId !== null && activeForceRowIds.has(rowId);
};
