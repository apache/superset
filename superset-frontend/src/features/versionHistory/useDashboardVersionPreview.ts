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
import { t } from '@apache-superset/core/translation';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { hydrateDashboard } from 'src/dashboard/actions/hydrate';
import type { RootState } from 'src/dashboard/types';
import {
  fetchDashboardHydrationData,
  fetchVersionSnapshot,
  DashboardHydrationData,
} from './api';
import {
  clearVersionPreview,
  selectVersionPreview,
  selectVersionRestoreCount,
} from './reducer';

type HydrateParams = Parameters<typeof hydrateDashboard>[0];

/**
 * Applies a previewed dashboard version by re-hydrating the page with the
 * snapshot's title/css/metadata/layout while keeping the live charts, and
 * re-hydrates the live dashboard when the preview is closed.
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
    const hydrateWith = (dashboard: object, charts: object[]) => {
      dispatch(
        hydrateDashboard({
          history,
          dashboard,
          charts,
          dataMask: store.getState().dataMask,
          activeTabs: null,
          chartStates: null,
        } as unknown as HydrateParams),
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
        if (fetchId !== fetchIdRef.current) {
          return;
        }
        const { dashboard, charts } = liveDataRef.current;
        appliedVersionRef.current = versionUuid;
        hydrateWith(
          {
            ...dashboard,
            dashboard_title: snapshot.dashboard_title,
            css: snapshot.css ?? '',
            metadata: snapshot.json_metadata
              ? JSON.parse(snapshot.json_metadata)
              : {},
            position_data: snapshot.position_json
              ? JSON.parse(snapshot.position_json)
              : null,
          },
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
