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
import { useCallback, useRef, useState } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { DataMaskStateWithId, JsonObject } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { hydrateDashboard } from 'src/dashboard/actions/hydrate';
import type { HydrateDashboardData } from 'src/dashboard/actions/hydrate';
import {
  fetchDashboardHydrationData,
  type DashboardHydrationData,
} from 'src/features/versionHistory/api';
import { resolveSnapshotCharts } from 'src/features/versionHistory/useDashboardVersionPreview';
import type { ChangeRequest } from './types';

/** Payload keys that map onto hydration fields rather than straight across. */
const PARSED_FIELDS: Record<string, string> = {
  json_metadata: 'metadata',
  position_json: 'position_data',
};

function overlay(
  live: HydrateDashboardData,
  payload: JsonObject,
): HydrateDashboardData {
  const proposed: JsonObject = { ...(live as unknown as JsonObject) };
  Object.entries(payload).forEach(([field, value]) => {
    proposed[field] = value;
    const parsedKey = PARSED_FIELDS[field];
    if (parsedKey && typeof value === 'string') {
      try {
        proposed[parsedKey] = JSON.parse(value);
      } catch {
        // A payload that will not parse is a payload that would fail on
        // approval too. Leave the live value in place rather than blanking
        // the page, and let the approval surface the real error.
      }
    }
  });
  return proposed as unknown as HydrateDashboardData;
}

/**
 * Show the dashboard as it would be if this change were approved.
 *
 * Built from the live dashboard with the captured payload laid over it,
 * because the payload is a field-level request body rather than a snapshot.
 * That is the same composition approval performs -- the command receives the
 * body and applies it to the live asset -- so what the switch shows is what
 * approving would produce, not a separate rendering of it.
 *
 * Reuses the version preview's hydration path: resolveSnapshotCharts works
 * out which charts a given layout needs, and hydrateDashboard swaps the page
 * without unmounting it. Turning the switch off re-hydrates the live copy
 * cached on the way in, so a reviewer always lands back on what viewers see.
 */
export function useProposedPreview(changeRequest: ChangeRequest | null) {
  const dispatch = useDispatch();
  const store = useStore<{ dataMask: DataMaskStateWithId }>();
  const history = useHistory();
  const { addDangerToast } = useToasts();
  const [showing, setShowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const liveRef = useRef<DashboardHydrationData | null>(null);
  // The reviewer's filter selections at the moment they flipped the switch.
  // Hydration replaces the whole dashboard state, so without carrying this
  // the switch would quietly clear their filters and show a different slice
  // of the data than the one they were looking at.
  const liveMaskRef = useRef<DataMaskStateWithId>({});

  const canPreview =
    !!changeRequest &&
    changeRequest.asset_type === 'dashboard' &&
    changeRequest.operation === 'update' &&
    // Only the main dashboard update carries a body that can be laid over the
    // dashboard. Filter, colour and customization changes (command set) have
    // their own payload shapes, so those fall back to "What changed".
    !changeRequest.command;

  const apply = useCallback(
    async (next: boolean) => {
      if (!changeRequest || busy) return;
      setBusy(true);
      try {
        if (next) {
          if (!Object.keys(liveMaskRef.current).length) {
            liveMaskRef.current = store.getState().dataMask ?? {};
          }
          // Cache the live copy on the way in: it is what the switch
          // returns to, and re-fetching on the way out could pick up
          // someone else's save and silently show a third state.
          const live =
            liveRef.current ??
            (await fetchDashboardHydrationData(changeRequest.asset_id));
          liveRef.current = live;

          const proposed = overlay(
            live.dashboard,
            (changeRequest.proposed ?? {}) as JsonObject,
          );
          const { charts, positionData } = await resolveSnapshotCharts(
            live.charts,
            (proposed as unknown as JsonObject).position_data as JsonObject,
          );
          dispatch(
            hydrateDashboard({
              history,
              dashboard: {
                ...proposed,
                position_data: positionData,
              } as HydrateDashboardData,
              charts: charts.length ? charts : live.charts,
              dataMask: liveMaskRef.current,
              activeTabs: null,
              chartStates: null,
              editMode: false,
            }),
          );
        } else if (liveRef.current) {
          dispatch(
            hydrateDashboard({
              history,
              dashboard: liveRef.current.dashboard,
              charts: liveRef.current.charts,
              dataMask: liveMaskRef.current,
              activeTabs: null,
              chartStates: null,
              editMode: false,
            }),
          );
        }
        setShowing(next);
      } catch (error) {
        addDangerToast(
          t('Could not show the proposed changes. Showing the live version.'),
        );
        setShowing(false);
      } finally {
        setBusy(false);
      }
    },
    [addDangerToast, busy, changeRequest, dispatch, history, store],
  );

  return { canPreview, showing, busy, toggle: apply };
}
