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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { useHistory } from 'react-router-dom';
import {
  DataMaskStateWithId,
  JsonObject,
  QueryFormData,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { hydrateDashboard } from 'src/dashboard/actions/hydrate';
import type { HydrateDashboardData } from 'src/dashboard/actions/hydrate';
import {
  fetchDashboardHydrationData,
  type DashboardHydrationData,
} from 'src/features/versionHistory/api';
import { resolveSnapshotCharts } from 'src/features/versionHistory/useDashboardVersionPreview';
import { announceProposedChart } from './events';
import { displayName } from './types';
import { hasProposedChart, proposedChartFormData } from './proposedChart';
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

  // The grid travels inside `json_metadata.positions`, not as
  // `position_json`. The shipped dashboard editor posts it there, and the
  // live row keeps it in the `position_json` column instead, so the two
  // sides of this overlay do not even name it the same thing. Mapping only
  // `position_json` therefore left `position_data` holding the live layout:
  // a proposal that resized, reordered, added or removed anything on the
  // grid redrew the live dashboard under a banner reading "Viewing your
  // changes", and the only thing that visibly moved was the title. The
  // sidebar named the moves correctly the whole time, so the two disagreed,
  // and a reviewer trusts the picture.
  //
  // `position_json` still wins where a payload carries it: it says the same
  // thing more directly.
  if (payload.position_json === undefined && payload.json_metadata !== undefined) {
    const positions = (proposed.metadata as JsonObject | undefined)?.positions;
    if (positions && typeof positions === 'object') {
      proposed.position_data = positions;
    }
  }

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
 *
 * A chart takes the other route. There is no hydration to do -- the proposal
 * is one chart's worth of controls -- and writing it into Explore's controls
 * would leave a reviewer's session looking like an edit of their own. So the
 * form data is handed to Explore, which draws it beside the live controls
 * and in place of the live chart (129075).
 */
export function useProposedPreview(changeRequest: ChangeRequest | null) {
  const dispatch = useDispatch();
  const store = useStore<{
    dataMask: DataMaskStateWithId;
    explore?: { form_data?: QueryFormData };
  }>();
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

  const isChart = changeRequest?.asset_type === 'chart';

  const canPreview =
    !!changeRequest &&
    changeRequest.operation === 'update' &&
    // Only the main dashboard/chart update carries a body that can be laid
    // over the asset. Filter, colour and customization changes (command set)
    // have their own payload shapes, so those fall back to "What changed".
    !changeRequest.command &&
    (changeRequest.asset_type === 'dashboard' ||
      // Asked of `changed_fields`, not of the payload: Explore's Save posts
      // every control on every save, so keying on "is `params` present"
      // offered the switch on every chart save whatever it touched. This
      // catches a rename that carries `slice_name` alone; it does not catch
      // one made through Explore, which moves `params` for real. See
      // `proposedChart.ts` for what was measured and what closing it needs.
      (isChart && hasProposedChart(changeRequest.changed_fields)));

  // Named here so the preview can say which decision comes first. A chart
  // approved against a dataset whose own change is still open publishes
  // against columns that do not exist yet, and viewers see it break (QA-09).
  const pending = changeRequest?.pending_dependency;
  // Memoized: it is read inside `apply`, and a fresh object every render
  // would rebuild that callback on every render with it.
  const dependency = useMemo(
    () =>
      pending && pending.asset_type === 'dataset'
        ? {
            title: pending.title ?? null,
            author: displayName(pending.author) || null,
          }
        : null,
    [pending],
  );

  const apply = useCallback(
    async (next: boolean) => {
      if (!changeRequest || busy) return;
      setBusy(true);
      try {
        if (isChart) {
          // Nothing to fetch and nothing to hydrate: the captured body
          // carries the whole visualization, so the only work is composing
          // it against the live chart and handing it over.
          if (next) {
            const proposed = proposedChartFormData(
              store.getState().explore?.form_data,
              changeRequest.proposed as JsonObject,
            );
            if (!proposed) {
              throw new Error('no proposed chart in this change');
            }
            announceProposedChart({
              previewable: true,
              formData: proposed,
              pendingDataset: dependency,
            });
          } else {
            announceProposedChart({
              previewable: true,
              formData: null,
              pendingDataset: dependency,
            });
          }
          setShowing(next);
          return;
        }
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
    [
      addDangerToast,
      busy,
      changeRequest,
      dependency,
      dispatch,
      history,
      isChart,
      store,
    ],
  );

  /**
   * Tell Explore what to draw, and stop telling it when there is nothing.
   *
   * Keyed on the change itself, not only on the switch, because the switch
   * can outlive the change. ``AssetReview`` calls this hook before it
   * decides whether to render anything, so when the change request goes
   * away the banner and the switch disappear while this hook stays mounted.
   * A reviewer whose decision was refused -- the commonest way that
   * happens, since the refusal path re-reads and finds the change gone --
   * was left on a proposal with no switch to turn off and no banner
   * explaining it, until they reloaded by hand.
   *
   * The key carries the revision too, so an author re-saving under a
   * reviewer drops the preview back to live rather than leaving a stale
   * picture on screen that the reviewer might then approve.
   */
  const previewKey = isChart
    ? `${changeRequest?.id ?? ''}:${changeRequest?.revision ?? changeRequest?.changed_on ?? ''}`
    : '';
  const lastKeyRef = useRef(previewKey);
  useEffect(() => {
    // Deliberately not guarded on `isChart`: the change going away is the
    // case this exists for, and by then `isChart` is false too. The key is
    // the empty string whenever there is no chart change, so a dashboard
    // never sees it move and never gets a spurious reset.
    if (lastKeyRef.current !== previewKey) {
      lastKeyRef.current = previewKey;
      setShowing(false);
    }
  }, [previewKey]);

  const previewable = isChart && canPreview;

  /**
   * Explore is told the whole state, every time any of it moves.
   *
   * One announcement rather than several, because they share a channel: an
   * effect that announced "nothing" in its cleanup ran that cleanup on
   * every dependency change, not only on unmount, so an author re-saving
   * made the notice blink out and back while the reviewer was reading it.
   *
   * The form data itself is announced by ``apply``, which is the only place
   * that composes it; this effect covers the two states that need no
   * composition.
   */
  useEffect(() => {
    // Not guarded on `isChart`. The change going away is the case this
    // exists for, and by then `isChart` is false too, so a guard here would
    // leave Explore drawing a proposal that no longer exists. On a
    // dashboard page Explore is not mounted and the announcement is a
    // no-op.
    if (!previewable) {
      announceProposedChart({ previewable: false, formData: null });
    } else if (!showing) {
      announceProposedChart({
        previewable: true,
        formData: null,
        pendingDataset: dependency,
      });
    }
    // `dependency` is rebuilt on every render; `previewKey` is what actually
    // tracks the change it is derived from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewable, showing, previewKey]);

  // Unmount only. Whatever Explore was left showing, it is not ours to keep
  // once this component goes.
  useEffect(
    () => () => announceProposedChart({ previewable: false, formData: null }),
    [],
  );

  return { canPreview, showing, busy, toggle: apply };
}
