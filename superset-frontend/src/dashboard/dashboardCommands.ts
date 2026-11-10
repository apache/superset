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
 * @fileoverview What a dashboard can do for whoever is holding a write.
 *
 * Explore publishes a command that draws a held version of its chart (see
 * `explore/exploreCommands.ts`); this is the same thing for a dashboard, for
 * the same reason. A dashboard is drawn from the store: `hydrateDashboard`
 * rebuilds it from a layout, the snapshot's charts have to be resolved
 * against the ones the page already has, and the reader's filter selections
 * live in a slice an extension cannot read, because `react-redux` and the
 * store are deliberately not shared with extensions. An extension that held
 * a copy of any of that would be driving a second store that nothing draws
 * from.
 *
 * So the host keeps the verb and publishes it, named for what this page
 * does rather than for anybody's reason for wanting it. Whether the command
 * exists is the answer to "can this page draw a held version", and it is
 * only registered while a dashboard is on screen.
 *
 * It is an action, not a reading. It resolves when the page has been
 * re-hydrated, and nothing about the result is reactive state the caller has
 * to subscribe to -- that is the reason it is one command and not a command
 * plus a channel, which is the shape Explore needed because a chart is drawn
 * by a component the store feeds. Here the store is fed directly.
 */
import { useEffect, useRef } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { useHistory } from 'react-router-dom';
import type { DataMaskStateWithId, JsonObject } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { commands } from 'src/core/commands';
// A *type-only* import, deliberately. `src/views/store` builds the store at
// module scope (`export const store = setupStore()`), so importing a value
// from it runs that on any require -- and the require chain reaches here from
// SliceHeaderControls through DrillDetailModal and DashboardPage, which made
// that component's tests fail to load at all. The type is erased, so nothing
// is pulled in at runtime.
import type { AppDispatch } from 'src/views/store';
import { clearDataMaskState } from 'src/dataMask/actions';
import {
  hydrateDashboard,
  HydrateDashboardData,
} from 'src/dashboard/actions/hydrate';
import {
  fetchDashboardHydrationData,
  type DashboardHydrationData,
} from 'src/features/versionHistory/api';
import {
  resolveSnapshotCharts,
  resolveSnapshotTheme,
} from 'src/features/versionHistory/useDashboardVersionPreview';
import { selectVersionPreview } from 'src/features/versionHistory/reducer';
import type { RootState } from 'src/dashboard/types';
import { SupersetClient } from '@superset-ui/core';
import { dashboardInfoChanged } from 'src/dashboard/actions/dashboardInfo';
import { composeHeldDashboard } from './heldDashboard';

/**
 * Put a held version of this dashboard on screen, or the live dashboard back.
 *
 * Arguments:
 *
 * 1. `heldFields` -- the write that is being held, as the fields it would
 *    apply (`dashboard_title`, `css`, `json_metadata`, `position_json`, ...).
 *    `null`, `undefined` or an empty body means "the live dashboard".
 *
 * Resolves `true` when the version asked for is now on screen. For
 * `heldFields` that is the held version; for none it is the live dashboard,
 * including when the live dashboard was already there, so calling it with
 * nothing is always safe. Resolves `false`, leaving the page exactly as it
 * was, when the page is not in a state to show one: no dashboard has loaded
 * yet, a version from the version history is on screen, there are unsaved
 * edits that re-hydrating would discard, or the held fields change nothing
 * that is drawn or do not compose into a dashboard (a layout that is not
 * JSON). Rejects, again with the page untouched, if a request needed to
 * build the held version fails.
 *
 * The reader's filter selections come across in both directions, and the
 * page stays in edit mode if it was in it.
 */
export const SHOW_HELD_VERSION_COMMAND = 'dashboard.heldVersion.show';

/**
 * Re-read who may edit this dashboard, into the store the page saves from.
 *
 * Saving sends `editors` from `dashboardInfo`, which is read once when the
 * page loads. Anything that changes the editors while the page is open --
 * the properties modal persists immediately, and so does an extension that
 * adds an approver through `PUT /api/v1/dashboard/{id}` -- leaves that copy
 * behind, and the next save writes the stale list back and removes whoever
 * was added.
 *
 * So whoever makes that change asks for this afterwards. It is the host's to
 * do: `dashboardInfo` is a store slice, and the store is deliberately not
 * shared with extensions.
 */
export const REREAD_EDITORS_COMMAND = 'dashboard.editors.reread';

const asHeld = (fields?: JsonObject | null): JsonObject | null =>
  fields && typeof fields === 'object' && Object.keys(fields).length
    ? fields
    : null;

/**
 * Offer the command for as long as a dashboard is on screen.
 *
 * Registered from the page and disposed on the way out, for the reason
 * Explore's are: it is about *this* dashboard, and one left registered by a
 * page that has gone would draw a held version over whatever came next.
 * Nothing is dispatched from the way out. The store belongs to whatever page
 * is next by then, and re-hydrating it with this one's live copy would be
 * the same mistake in the other direction.
 *
 * Everything the command needs is read through refs and `getState()`, so
 * the registration survives every render instead of warning on each one
 * (`registerCommand` overwrites a duplicate id and says so).
 */
export function useDashboardCommands(): void {
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore<RootState>();
  const history = useHistory();
  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // Registered alongside the held-version command and for the same reason:
  // it is a verb about this page that only the host can perform.
  useEffect(() => {
    const reread = async (): Promise<boolean> => {
      const id = store.getState().dashboardInfo?.id;
      if (!id) return false;
      try {
        const { json } = await SupersetClient.get({
          endpoint: `/api/v1/dashboard/${id}`,
        });
        const editors = (json as { result?: { editors?: unknown } })?.result
          ?.editors;
        // Absent rather than empty means the response did not carry the
        // field; writing `[]` then would do the very thing this exists to
        // prevent.
        if (editors === undefined) return false;
        dispatch(dashboardInfoChanged({ editors } as never));
        return true;
      } catch {
        // A stale list is worse than a failed refresh only when it is
        // written back, and the caller is about to find that out from the
        // save itself.
        return false;
      }
    };

    const registration = commands.registerCommand(
      {
        id: REREAD_EDITORS_COMMAND,
        title: t("Re-read this dashboard's editors"),
        description: t(
          'Reload who may edit this dashboard into the page, so the next save does not write back a list read before they changed.',
        ),
      },
      reread,
    );
    return () => registration.dispose();
  }, [dispatch, store]);

  useEffect(() => {
    // What the page was showing before the first held version went up: the
    // copy returned to, the reader's selections, and whether they were
    // editing. Cached on the way in rather than re-fetched on the way out,
    // because a second fetch could pick up somebody else's save and put a
    // third state on screen that nobody asked for.
    let live: (DashboardHydrationData & { dashboardId: number }) | null = null;
    let liveMask: DataMaskStateWithId = {};
    let editModeBefore = false;
    // Bumped by every call and by dispose, so a request that resolves after
    // a later one -- or after the page has gone -- does not hydrate.
    let generation = 0;

    const rehydrate = (
      dashboard: HydrateDashboardData,
      charts: DashboardHydrationData['charts'],
      dataMask: DataMaskStateWithId,
      editMode: boolean,
    ) => {
      // Hydration merges into the dataMask already in the store, which would
      // let a selection from one version leak into the other. Reset first so
      // each hydrate starts from exactly the selections passed in; the two
      // dispatches are synchronous, so React renders them together.
      dispatch(clearDataMaskState());
      dispatch(
        hydrateDashboard({
          history: historyRef.current,
          dashboard,
          charts,
          dataMask,
          // Null keeps what the page has: hydration seeds the tabs and the
          // per-chart state from the store when it is not told otherwise.
          activeTabs: null,
          chartStates: null,
          editMode,
        }),
      );
    };

    const canReplacePage = (state: RootState): boolean =>
      state.dashboardInfo?.id !== undefined &&
      !state.dashboardState?.hasUnsavedChanges &&
      !state.dashboardState?.dashboardIsSaving &&
      // A version from the history is on screen and owns the page: the
      // preview's own exit puts back its copy, not ours.
      !selectVersionPreview(
        state as unknown as Parameters<typeof selectVersionPreview>[0],
      );

    const returnToLive = (): boolean => {
      generation += 1;
      const cached = live;
      live = null;
      if (!cached) return true; // nothing is held, so live is what is on screen
      const state = store.getState();
      if (state.dashboardInfo?.id !== cached.dashboardId) {
        // A different dashboard is loaded now; the copy is no longer ours
        // to put back.
        return true;
      }
      rehydrate(
        cached.dashboard,
        cached.charts,
        liveMask,
        // Back to editing if that is where they were, and still editing if
        // they pressed Edit while the held version was up. Hydration would
        // otherwise read the `edit` URL parameter, which is absent for
        // anyone who pressed the button, and end their session.
        Boolean(state.dashboardState?.editMode) || editModeBefore,
      );
      liveMask = {};
      editModeBefore = false;
      return true;
    };

    const show = async (heldFields?: JsonObject | null): Promise<boolean> => {
      const held = asHeld(heldFields);
      if (!held) return returnToLive();

      generation += 1;
      const mine = generation;
      const before = store.getState();
      if (!canReplacePage(before)) return false;
      const dashboardId = before.dashboardInfo.id as number;

      // Switching from one held version to another keeps the copy taken on
      // the way in. From live it takes a fresh one.
      const base =
        live && live.dashboardId === dashboardId
          ? live
          : {
              ...(await fetchDashboardHydrationData(dashboardId)),
              dashboardId,
            };
      const theme =
        'theme_id' in held
          ? await resolveSnapshotTheme(
              (held.theme_id as number | null) ?? null,
              base.dashboard.theme ?? null,
            )
          : undefined;
      const composed = composeHeldDashboard(base.dashboard, held, theme);
      if (!composed) return false;
      const { charts, positionData } = await resolveSnapshotCharts(
        base.charts,
        composed.position_data as JsonObject | null,
      );

      // Everything below is synchronous, from the last check to the
      // dispatch. The page may have moved on while the requests were out.
      const now = store.getState();
      if (
        mine !== generation ||
        now.dashboardInfo?.id !== dashboardId ||
        !canReplacePage(now)
      ) {
        return false;
      }
      if (live?.dashboardId !== dashboardId) {
        live = base;
        liveMask = now.dataMask ?? {};
        editModeBefore = Boolean(now.dashboardState?.editMode);
      }
      rehydrate(
        { ...composed, position_data: positionData } as HydrateDashboardData,
        charts.length ? charts : base.charts,
        // Carried across rather than reset: a reader who filtered and then
        // asked to see the held version has not asked for a different slice
        // of the data. The selections read here are the reader's current
        // ones, so they also follow a switch from one held version to
        // another. A filter the held version no longer has simply has
        // nothing to attach to.
        now.dataMask ?? {},
        Boolean(now.dashboardState?.editMode),
      );
      return true;
    };

    const registration = commands.registerCommand(
      {
        id: SHOW_HELD_VERSION_COMMAND,
        title: t('Show a held version of this dashboard'),
        description: t(
          'Draw the version of this dashboard that a write holder is keeping, in place of the live one. Called with nothing, it puts the live dashboard back.',
        ),
      },
      show,
    );
    return () => {
      registration.dispose();
      generation += 1;
      live = null;
    };
  }, [dispatch, store]);
}
