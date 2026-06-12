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
import type { JsonObject } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import {
  hydrateDashboard,
  HydrateChartData,
  HydrateDashboardData,
} from 'src/dashboard/actions/hydrate';
import { CHART_TYPE, MARKDOWN_TYPE } from 'src/dashboard/util/componentTypes';
import type { RootState } from 'src/dashboard/types';
import {
  fetchDashboardHydrationData,
  fetchExploreRehydrationData,
  fetchVersionSnapshot,
  DashboardHydrationData,
} from './api';
import {
  clearVersionPreview,
  selectVersionPreview,
  selectVersionRestoreCount,
} from './reducer';

export interface SnapshotChartResolution {
  charts: HydrateChartData[];
  positionData: JsonObject | null;
}

const layoutChartId = (item: JsonObject): number | null => {
  const meta = item?.meta as JsonObject | undefined;
  return item?.type === CHART_TYPE && typeof meta?.chartId === 'number'
    ? (meta.chartId as number)
    : null;
};

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
  await Promise.all(
    missingIds.map(async id => {
      try {
        const { slice, form_data } = await fetchExploreRehydrationData(id);
        charts.push({
          slice_id: id,
          slice_url: `/explore/?slice_id=${id}`,
          slice_name: slice?.slice_name ?? t('Untitled chart'),
          form_data: { ...form_data, slice_id: id },
          description: slice?.description ?? '',
          description_markeddown: '',
          owners: [],
          modified: '',
          changed_on: new Date().toISOString(),
        });
      } catch {
        unreachable.add(id);
      }
    }),
  );

  if (unreachable.size === 0) {
    return { charts, positionData };
  }

  const layout: JsonObject = { ...positionData };
  Object.entries(layout).forEach(([key, item]) => {
    const chartId = layoutChartId(item as JsonObject);
    if (chartId !== null && unreachable.has(chartId)) {
      const meta = (item as JsonObject).meta as JsonObject;
      layout[key] = {
        ...(item as JsonObject),
        type: MARKDOWN_TYPE,
        meta: {
          width: meta?.width,
          height: meta?.height,
          code: t('This chart no longer exists.'),
        },
      };
    }
  });
  return { charts, positionData: layout };
}

/**
 * Applies a previewed dashboard version by re-hydrating the page with the
 * snapshot's title/css/metadata/layout and the charts that layout references,
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
  const appliedVersionRef = useRef<string | null>(null);
  const fetchIdRef = useRef(0);
  const restoreCount = useSelector(selectVersionRestoreCount);
  const lastRestoreCountRef = useRef(restoreCount);

  const versionUuid = preview?.versionUuid;

  useEffect(() => {
    const hydrateWith = (
      dashboard: HydrateDashboardData,
      charts: HydrateChartData[],
    ) => {
      dispatch(
        hydrateDashboard({
          history,
          dashboard,
          charts,
          dataMask: store.getState().dataMask,
          activeTabs: null,
          chartStates: null,
        }),
      );
    };

    if (restoreCount !== lastRestoreCountRef.current) {
      // The dashboard changed on the server (a version was restored);
      // drop the cached live data and rehydrate with a fresh copy.
      lastRestoreCountRef.current = restoreCount;
      appliedVersionRef.current = null;
      liveDataRef.current = null;
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
          hydrateWith(data.dashboard, data.charts);
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
      const apply = async () => {
        if (!liveDataRef.current) {
          liveDataRef.current = await fetchDashboardHydrationData(dashboardId);
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
          liveDataRef.current.charts,
          snapshotLayout,
        );
        if (fetchId !== fetchIdRef.current) {
          return;
        }
        const { dashboard } = liveDataRef.current;
        appliedVersionRef.current = versionUuid;
        hydrateWith(
          {
            ...dashboard,
            dashboard_title: snapshot.dashboard_title,
            css: snapshot.css ?? '',
            metadata: snapshot.json_metadata
              ? JSON.parse(snapshot.json_metadata)
              : {},
            position_data: positionData,
          } as HydrateDashboardData,
          charts,
        );
      };
      apply().catch(() => {
        if (fetchId === fetchIdRef.current) {
          addDangerToast(t('Failed to load version preview'));
          dispatch(clearVersionPreview());
        }
      });
    } else if (!versionUuid && appliedVersionRef.current) {
      // Preview closed; put the live dashboard back.
      fetchIdRef.current += 1;
      appliedVersionRef.current = null;
      const liveData = liveDataRef.current;
      if (liveData) {
        hydrateWith(liveData.dashboard, liveData.charts);
      }
    }
  }, [
    addDangerToast,
    dashboardId,
    dispatch,
    history,
    restoreCount,
    store,
    uuid,
    versionUuid,
  ]);
}
