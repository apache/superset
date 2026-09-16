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
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { useHistory } from 'react-router-dom';
import type { DataMaskStateWithId, JsonObject } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import {
  hydrateDashboard,
  HydrateChartData,
  HydrateDashboardData,
} from 'src/dashboard/actions/hydrate';
import { clearDataMaskState } from 'src/dataMask/actions';
import type { RootState } from 'src/dashboard/types';
import {
  fetchDashboardHydrationData,
  fetchDashboardTheme,
  fetchExploreRehydrationData,
  fetchVersionSnapshot,
  layoutChartId,
  swapUnreachableChartSlots,
  DashboardHydrationData,
  DashboardTheme,
} from './api';
import {
  clearVersionPreview,
  selectVersionLastRestoredUuid,
  selectVersionPreview,
  selectVersionRestoreCount,
  versionPreviewApplied,
} from './reducer';

export interface SnapshotChartResolution {
  charts: HydrateChartData[];
  positionData: JsonObject | null;
}

// /api/v1/explore/ resolves a single chart per request, so unlike
// fetchReachableChartIds there is nothing to batch. Bound the concurrency
// instead: a snapshot whose layout references many charts the dashboard no
// longer holds would otherwise open one request per chart at once.
const EXPLORE_REHYDRATION_CONCURRENCY = 6;

/** Runs `worker` over `items`, with at most `limit` in flight at a time. */
async function forEachWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runner = async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await worker(item);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, runner),
  );
}

/**
 * A version snapshot stores the layout (position_json) but not the charts
 * themselves, while the live dashboard payload only includes the charts the
 * dashboard references at present. Reconcile the two: keep live charts the
 * snapshot layout references (dropping ones added after the snapshot, so the
 * hydrate "append new slices" path never fires), fetch metadata for charts
 * the dashboard no longer includes, and swap layout slots whose chart cannot
 * be fetched (e.g. deleted) for a markdown placeholder.
 */
export async function resolveSnapshotCharts(
  liveCharts: HydrateChartData[],
  positionData: JsonObject | null,
): Promise<SnapshotChartResolution> {
  if (!positionData || Object.keys(positionData).length === 0) {
    // The snapshot has no layout; hydrate falls back to an empty layout and
    // appends any charts it is given, so pass none.
    return { charts: [], positionData };
  }

  const snapshotChartIds = new Set<number>();
  Object.values(positionData).forEach(item => {
    const chartId = layoutChartId(item as JsonObject);
    if (chartId !== null) {
      snapshotChartIds.add(chartId);
    }
  });

  const liveById = new Map(
    liveCharts.map(chart => [
      (chart.form_data?.slice_id as number | undefined) ?? chart.slice_id,
      chart,
    ]),
  );
  const charts: HydrateChartData[] = [];
  const missingIds: number[] = [];
  snapshotChartIds.forEach(id => {
    const live = liveById.get(id);
    if (live) {
      charts.push(live);
    } else {
      missingIds.push(id);
    }
  });

  const unreachable = new Set<number>();
  await forEachWithConcurrency(
    missingIds,
    EXPLORE_REHYDRATION_CONCURRENCY,
    async id => {
      try {
        const { slice, form_data } = await fetchExploreRehydrationData(id);
        charts.push({
          slice_id: id,
          slice_url: `/explore/?slice_id=${id}`,
          slice_name: slice?.slice_name ?? t('Untitled chart'),
          form_data: { ...form_data, slice_id: id },
          description: slice?.description ?? '',
          description_markeddown: '',
          editors: [],
          modified: '',
          changed_on: new Date().toISOString(),
        });
      } catch {
        unreachable.add(id);
      }
    },
  );

  return {
    charts,
    positionData: swapUnreachableChartSlots(positionData, unreachable),
  };
}

/**
 * The version table stores `theme_id`, while hydration wants the theme
 * object. One lookup only when the snapshot's theme differs from the live
 * one; a failed lookup keeps the live theme rather than dropping the
 * preview, since the theme is the least load-bearing of the scalars.
 */
async function resolveSnapshotTheme(
  snapshotThemeId: number | null,
  liveTheme: DashboardTheme | null,
): Promise<DashboardTheme | null> {
  if (snapshotThemeId == null) {
    return null;
  }
  if (liveTheme?.id === snapshotThemeId) {
    return liveTheme;
  }
  try {
    return await fetchDashboardTheme(snapshotThemeId);
  } catch {
    return liveTheme;
  }
}

/**
 * Applies a previewed dashboard version by re-hydrating the page with the
 * snapshot's scalars (title, css, metadata, description, slug, certification,
 * published state, theme) and layout, plus the charts that layout references,
 * and re-hydrates the live dashboard when the preview is closed.
 */
export function useDashboardVersionPreview(uuid: string | undefined) {
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const history = useHistory();
  const { addDangerToast } = useToasts();
  const preview = useSelector(selectVersionPreview);
  const dashboardId = useSelector<RootState, number | undefined>(
    state => state.dashboardInfo?.id,
  );
  const liveDataRef = useRef<DashboardHydrationData | null>(null);
  // The user's filter selections at the moment they entered preview, restored
  // when the preview closes. Captured once per live -> preview transition so
  // switching between previewed versions keeps the original live state.
  const liveDataMaskRef = useRef<DataMaskStateWithId | null>(null);
  const appliedVersionRef = useRef<string | null>(null);
  const fetchIdRef = useRef(0);
  const restoreCount = useSelector(selectVersionRestoreCount);
  const lastRestoredUuid = useSelector(selectVersionLastRestoredUuid);
  const lastRestoreCountRef = useRef(restoreCount);
  // Saves bump one of two redux signals depending on the path: edit-mode
  // saves round-trip through ON_SAVE (dashboardState.lastModifiedTime),
  // while native-filter and properties saves bump
  // dashboardInfo.last_modified_time.
  const saveSignal = useSelector<RootState, string>(state =>
    [
      state.dashboardState?.lastModifiedTime ?? '',
      state.dashboardInfo?.last_modified_time ?? '',
    ].join('|'),
  );
  const lastSaveSignalRef = useRef(saveSignal);
  // Hydration writes to the global store, which outlives this hook. The
  // fetch-id guard below only invalidates requests superseded by another
  // preview; nothing bumps it on unmount, so an apply() still in flight when
  // the user navigates away would hydrate a dashboard over whatever page
  // mounted next.
  const isMountedRef = useRef(true);
  useEffect(
    () => () => {
      isMountedRef.current = false;
      // The versionHistory slice is global and outlives this page; an
      // apply() settling after unmount must not dispatch completion (or, on
      // its failure path, clear a preview the *next* page just requested).
      // Invalidating the fetch id silences every guarded continuation at
      // once.
      fetchIdRef.current += 1;
    },
    [],
  );

  const versionUuid = preview?.versionUuid;

  // A save that lands while no preview is applied makes the cached live
  // copy stale — exiting a later preview would rehydrate the pre-save
  // state (and a subsequent edit-mode save could overwrite the newer
  // server state with it). Drop the cache so the next preview entry
  // fetches a fresh live copy. While a preview is applied, saves are
  // gated off in the UI and the cache must be kept for exit-preview, so
  // only the not-previewing case clears it.
  useEffect(() => {
    if (saveSignal === lastSaveSignalRef.current) {
      return;
    }
    lastSaveSignalRef.current = saveSignal;
    if (appliedVersionRef.current === null) {
      liveDataRef.current = null;
      liveDataMaskRef.current = null;
    }
  }, [saveSignal]);

  useEffect(() => {
    const hydrateWith = (
      dashboard: HydrateDashboardData,
      charts: HydrateChartData[],
      dataMask: DataMaskStateWithId,
      editMode?: boolean,
    ) => {
      if (!isMountedRef.current) {
        return;
      }
      // Hydration merges into any existing dataMask entries, which would let
      // filter selections from one version leak into another; reset first so
      // each hydrate starts from exactly the dataMask passed in. The two
      // dispatches are synchronous back-to-back, so React batches them into
      // a single render.
      dispatch(clearDataMaskState());
      dispatch(
        hydrateDashboard({
          history,
          dashboard,
          charts,
          dataMask,
          activeTabs: null,
          chartStates: null,
          editMode,
        }),
      );
    };

    if (restoreCount !== lastRestoreCountRef.current) {
      lastRestoreCountRef.current = restoreCount;
      if (lastRestoredUuid !== uuid) {
        // A restore of some other entity, resolving after navigation. This
        // dashboard did not change on the server; rehydrating would clear its
        // filters and unsaved state for someone else's restore.
        return;
      }
      // The dashboard changed on the server (a version was restored);
      // drop the cached live data and rehydrate with a fresh copy.
      appliedVersionRef.current = null;
      liveDataRef.current = null;
      liveDataMaskRef.current = null;
      if (!dashboardId) {
        return;
      }
      fetchIdRef.current += 1;
      const fetchId = fetchIdRef.current;
      fetchDashboardHydrationData(dashboardId)
        .then(data => {
          if (fetchId !== fetchIdRef.current) {
            return;
          }
          liveDataRef.current = data;
          // A restored version behaves like a fresh page load: its own
          // filter defaults, no carried-over selections. Explicitly not
          // edit mode: a stale `?edit=true` in the URL (it outlives the
          // navigation that set it) must not flip the page into edit mode
          // as a side effect of the reload.
          hydrateWith(data.dashboard, data.charts, {}, false);
        })
        .catch(() => {
          if (fetchId === fetchIdRef.current) {
            addDangerToast(t('Failed to reload the restored version'));
          }
        });
      return;
    }

    if (versionUuid && uuid && dashboardId) {
      if (appliedVersionRef.current === versionUuid) {
        return;
      }
      fetchIdRef.current += 1;
      const fetchId = fetchIdRef.current;
      // A save resolving while this apply is in flight (e.g. a properties
      // save confirmed just before the preview opened) moves the save signal
      // and outdates the copy being fetched below; capture the generation so
      // the cache commit can tell.
      const saveSignalAtStart = lastSaveSignalRef.current;
      const apply = async () => {
        // Work on a local copy and commit it to the cache only after the
        // staleness check below — an in-flight fetch resolving after a
        // restore (which cleared the cache) must not repopulate it with
        // pre-restore content.
        let liveData = liveDataRef.current;
        if (!liveData) {
          liveData = await fetchDashboardHydrationData(dashboardId);
        }
        const snapshot = await fetchVersionSnapshot(
          'dashboard',
          uuid,
          versionUuid,
        );
        const snapshotLayout: JsonObject | null = snapshot.position_json
          ? JSON.parse(snapshot.position_json)
          : null;
        const { charts, positionData } = await resolveSnapshotCharts(
          liveData.charts,
          snapshotLayout,
        );
        // Resolved here, with the other pre-check awaits, and deliberately
        // not later: everything from the cache commit to the hydrate below
        // must stay synchronous. The save-signal effect nulls the cache
        // whenever no preview is applied yet, so an await in that stretch
        // lets a save land between the commit and `appliedVersionRef`,
        // leaving a preview applied over a null cache — exit-preview only
        // rehydrates `if (liveData)`, so the page would keep showing
        // historical content after the banner disappeared.
        const theme = await resolveSnapshotTheme(
          snapshot.theme_id,
          liveData.dashboard.theme ?? null,
        );
        if (fetchId !== fetchIdRef.current) {
          return;
        }
        if (lastSaveSignalRef.current !== saveSignalAtStart) {
          // A save landed mid-flight: the copy in hand predates it, and
          // caching it would let exit-preview resurrect pre-save state (and
          // a later edit-mode save persist it). Fetch a fresh copy instead.
          liveData = await fetchDashboardHydrationData(dashboardId);
          if (fetchId !== fetchIdRef.current) {
            return;
          }
        }
        liveDataRef.current = liveData;
        const { dashboard } = liveData;
        if (appliedVersionRef.current === null) {
          // Entering preview from the live dashboard: remember the user's
          // filter selections so closing the preview can bring them back.
          liveDataMaskRef.current = store.getState().dataMask;
        }
        appliedVersionRef.current = versionUuid;
        // The snapshot renders with its own filter defaults (from its
        // native_filter_configuration), not the live selections.
        hydrateWith(
          {
            ...dashboard,
            dashboard_title: snapshot.dashboard_title,
            css: snapshot.css ?? '',
            metadata: snapshot.json_metadata
              ? JSON.parse(snapshot.json_metadata)
              : {},
            position_data: positionData,
            // Every other scalar the version table carries. The snapshot
            // endpoint has always projected these; applying only title, css
            // and metadata left the preview showing the *live* certification
            // badge, draft/published pill and description over historical
            // content.
            description: snapshot.description,
            slug: snapshot.slug,
            certified_by: snapshot.certified_by,
            certification_details: snapshot.certification_details,
            published: snapshot.published ?? false,
            theme,
          } as HydrateDashboardData,
          charts,
          {},
          // Never edit mode: `?edit=true` outlives the navigation that set
          // it, so deriving it from the URL would leave a live Save toolbar
          // over a historical snapshot.
          false,
        );
      };
      apply()
        .then(() => {
          // Only the request that is still current may announce completion;
          // a superseded one resolving later must not clear the flag for the
          // preview that replaced it.
          if (fetchId === fetchIdRef.current) {
            dispatch(versionPreviewApplied());
          }
        })
        .catch(() => {
          if (fetchId === fetchIdRef.current) {
            addDangerToast(t('Failed to load version preview'));
            dispatch(clearVersionPreview(uuid));
          }
        });
    } else if (!versionUuid) {
      // Preview closed (including while its request is still pending).
      // Invalidate the request unconditionally so historical data cannot be
      // applied after the preview banner and interaction gates disappear.
      fetchIdRef.current += 1;
      if (!appliedVersionRef.current) {
        return;
      }
      // Put the live dashboard back along with the filter selections the
      // user had before previewing.
      appliedVersionRef.current = null;
      const liveData = liveDataRef.current;
      if (liveData) {
        // Explicitly not edit mode. The entry gate tests for unsaved
        // changes, not for edit mode, so a preview can be entered from an
        // edit session with nothing dirty — exit still lands in view mode,
        // which is the safe default for a page that just swapped its whole
        // store. Without the override a stale `?edit=true` in the URL (it
        // outlives the navigation that set it) would flip the page into
        // edit mode as a side effect of closing the preview.
        hydrateWith(
          liveData.dashboard,
          liveData.charts,
          liveDataMaskRef.current ?? {},
          false,
        );
      }
      liveDataMaskRef.current = null;
    }
  }, [
    addDangerToast,
    dashboardId,
    dispatch,
    history,
    lastRestoredUuid,
    restoreCount,
    store,
    uuid,
    versionUuid,
  ]);
}
