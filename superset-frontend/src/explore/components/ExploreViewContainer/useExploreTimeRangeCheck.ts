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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ControlStateMapping } from '@superset-ui/chart-controls';
import { JsonObject, QueryFormData } from '@superset-ui/core';
import { keepExploreQueryContext } from 'src/dashboard/actions/timeRangeLimits';
import { buildV1ChartDataPayload } from 'src/explore/exploreUtils';
import {
  ChartRangesCall,
  ChartRangesEntry,
  ChartRangesJudgement,
  describeFailure,
  fetchChartRanges,
  hasLimits,
  judgeChartRanges,
} from 'src/utils/timeRangeLimits';
import {
  ExploreTimeRangeCheck,
  ExploreTimeRangeLimits,
  exploreDashboardId,
  fetchExploreDashboardLimits,
  LimitsRootState,
  refreshExploreTimeRangeLimits,
  setTimeRangeCheck,
  setExploreTimeRangeLimits,
  timeRangeCheckErrors,
} from 'src/explore/actions/timeRangeLimitsActions';

export const CHECK_DEBOUNCE_MS = 300;

const ENTRY_KEY = 'explore';

/**
 * The body the chart-data request sends for this form data: its query context.
 * The main entry's is kept for that request, so a stateful `buildQuery` (the
 * table's page reset) runs once per change.
 */
export async function chartRangesEntry(
  formData: QueryFormData,
  ownState: JsonObject | undefined,
  force: boolean,
  key: string = ENTRY_KEY,
): Promise<ChartRangesEntry> {
  const queryContext = await buildV1ChartDataPayload({
    formData,
    force,
    resultFormat: 'json',
    resultType: 'full',
    setDataMask: () => {},
    ownState: ownState ?? {},
  });
  if (key === ENTRY_KEY) {
    keepExploreQueryContext(formData, ownState, queryContext);
  }
  return {
    key,
    query_context: queryContext as unknown as Record<string, unknown>,
  };
}

const OFFSET_CONTROLS = ['time_compare', 'time_compare_b'];
const OPTION_PREFIX = 'opt:';

/**
 * One entry per fixed choice of each time comparison control: the form data
 * with that offset as the control's only value and the sibling control empty.
 */
async function optionEntries(
  formData: QueryFormData,
  controls: ControlStateMapping,
  ownState: JsonObject | undefined,
  force: boolean,
): Promise<ChartRangesEntry[]> {
  const entries: Promise<ChartRangesEntry>[] = [];
  OFFSET_CONTROLS.forEach(name => {
    const control = controls[name];
    if (control?.type !== 'SelectControl' || !Array.isArray(control.choices)) {
      return;
    }
    const sibling = OFFSET_CONTROLS.find(other => other !== name) as string;
    (control.choices as [string, string][]).forEach(([value]) => {
      if (value === 'custom') {
        return;
      }
      entries.push(
        chartRangesEntry(
          {
            ...formData,
            [name]: control.multi ? [value] : value,
            ...(sibling in controls && { [sibling]: [] }),
          },
          ownState,
          force,
          `${OPTION_PREFIX}${name}:${value}`,
        ),
      );
    });
  });
  return Promise.all(entries);
}

/** The first reason each option breaks a limit, by control and option. */
function optionReasonsOf(
  judgements: Record<string, ChartRangesJudgement>,
): ExploreTimeRangeCheck['optionReasons'] {
  const reasons: ExploreTimeRangeCheck['optionReasons'] = {};
  Object.entries(judgements).forEach(([key, judgement]) => {
    if (!key.startsWith(OPTION_PREFIX) || judgement.status !== 'invalid') {
      return;
    }
    const failure = judgement.failures.find(
      ({ range, reason }) =>
        range.time_offset !== null && reason !== 'UNBOUNDED_RANGE',
    );
    if (!failure) {
      return;
    }
    const [, control, ...rest] = key.split(':');
    reasons[control] = {
      ...reasons[control],
      [rest.join(':')]: describeFailure(failure),
    };
  });
  return reasons;
}

type Answer = { key: string; calls: ChartRangesCall[] } | { key: string };

/**
 * Check the ranges of the request Explore would send now with the chart
 * ranges endpoint, and judge them with the global, dataset and (when the
 * server applies it) dashboard limits. The status is `pending` as soon as the
 * key changes; only the request waits for the edits to settle. Returns a
 * callback that sends the check again.
 */
export default function useExploreTimeRangeCheck({
  enabled,
  checkKey,
  formData,
  ownState,
  force,
  controls,
  limits,
  datasetName,
}: {
  enabled: boolean;
  checkKey: string;
  formData: QueryFormData;
  ownState: JsonObject | undefined;
  force: boolean;
  controls: ControlStateMapping;
  limits: ExploreTimeRangeLimits | undefined;
  datasetName: string;
}) {
  const dispatch = useDispatch();
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef({ checkKey, formData, ownState, force, controls });
  latest.current = { checkKey, formData, ownState, force, controls };
  const refreshedFor = useRef<string | null>(null);
  const storedReasons = useSelector(
    (state: LimitsRootState) => state.explore.timeRangeCheck?.optionReasons,
  );
  const lastReasons = useRef(storedReasons);
  lastReasons.current = storedReasons;
  const storedCheck = useSelector(
    (state: LimitsRootState) => state.explore.timeRangeCheck,
  );
  const lastCheck = useRef(storedCheck);
  lastCheck.current = storedCheck;

  const policy =
    limits?.status === 'loaded' && !limits.refreshing ? limits : null;
  const levels = policy?.levels;
  const datasetId = policy?.datasetId;
  const dashboard = limits?.dashboard;
  const dashboardId = exploreDashboardId(formData);
  const waitingForDashboard =
    !!levels &&
    !hasLimits(levels) &&
    dashboardId !== undefined &&
    (dashboard?.id !== dashboardId ||
      (dashboard.status !== 'loaded' && dashboard.status !== 'absent'));

  useEffect(() => {
    if (!enabled) {
      const last = lastCheck.current;
      if (last && Object.keys(last.controlErrors).length) {
        dispatch(setTimeRangeCheck({ key: last.key, status: 'valid' }));
      }
      return undefined;
    }
    setAnswer(null);
    dispatch(
      setTimeRangeCheck({
        key: checkKey,
        status: 'pending',
        optionReasons: levels ? lastReasons.current : {},
      }),
    );
    if (!levels) {
      return undefined;
    }
    if (waitingForDashboard && dashboardId !== undefined) {
      if (dashboard?.id !== dashboardId) {
        dispatch(fetchExploreDashboardLimits(dashboardId) as never);
      }
      return undefined;
    }
    let current = true;
    const timer = setTimeout(async () => {
      const { formData: body, ownState: state, force: forced } = latest.current;
      let entry: ChartRangesEntry;
      try {
        entry = await chartRangesEntry(body, state, forced);
      } catch {
        // The chart can't build its request; its own run shows the usual error.
        if (current) {
          setAnswer({ key: checkKey });
        }
        return;
      }
      let options: ChartRangesEntry[] = [];
      try {
        options = await optionEntries(
          body,
          latest.current.controls,
          state,
          forced,
        );
      } catch {
        // Without option entries the options stay enabled.
      }
      const calls = await fetchChartRanges([entry, ...options]);
      if (current && latest.current.checkKey === checkKey) {
        setAnswer({ key: checkKey, calls });
      }
    }, CHECK_DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [
    enabled,
    checkKey,
    levels,
    datasetId,
    attempt,
    dispatch,
    waitingForDashboard,
    dashboardId,
  ]);

  useEffect(() => {
    if (!enabled || !policy || !answer || answer.key !== checkKey) {
      return;
    }
    if (!('calls' in answer)) {
      dispatch(setTimeRangeCheck({ key: checkKey, status: 'error' }));
      return;
    }
    const [call] = answer.calls;
    const chart =
      call && 'result' in call
        ? call.result.charts.find(item => item.key === ENTRY_KEY)
        : undefined;
    if (chart?.status === 'ok') {
      if (chart.dataset_id !== null && chart.dataset_id !== policy.datasetId) {
        // Right after a dataset switch: wait for its limits, read once.
        if (refreshedFor.current !== checkKey) {
          refreshedFor.current = checkKey;
          dispatch(refreshExploreTimeRangeLimits() as never);
        } else {
          dispatch(setTimeRangeCheck({ key: checkKey, status: 'unavailable' }));
        }
        return;
      }
      if (
        chart.dashboard_id === null &&
        dashboardId !== undefined &&
        (dashboard?.id !== dashboardId || dashboard.status !== 'absent')
      ) {
        dispatch(
          setExploreTimeRangeLimits({
            ...policy,
            dashboard: { id: dashboardId, status: 'absent' },
          }),
        );
        return;
      }
      if (chart.dashboard_id !== null) {
        if (dashboard?.id !== chart.dashboard_id) {
          dispatch(fetchExploreDashboardLimits(chart.dashboard_id) as never);
          return;
        }
        if (dashboard.status === 'loading' || dashboard.status === 'failed') {
          dispatch(
            setTimeRangeCheck({
              key: checkKey,
              status: 'pending',
              optionReasons: {},
            }),
          );
          return;
        }
      }
    }
    const judgements = judgeChartRanges(answer.calls, {
      global: policy.levels[0]?.policy ?? null,
      datasets:
        policy.datasetId === null
          ? []
          : [
              {
                id: policy.datasetId,
                name: datasetName,
                policy: policy.levels[1]?.policy ?? {
                  max_span: null,
                  max_look_back: null,
                  max_look_forward: null,
                },
              },
            ],
      dashboard: dashboard?.status === 'loaded' ? dashboard.policy : null,
    });
    const judgement = judgements[ENTRY_KEY] ?? {
      status: 'unavailable' as const,
    };
    const optionReasons =
      judgement.status === 'valid' ||
      (judgement.status === 'invalid' &&
        judgement.failures.every(({ range }) => range.time_offset !== null))
        ? optionReasonsOf(judgements)
        : {};
    if (judgement.status === 'invalid' || judgement.status === 'unbounded') {
      const { controls: controlsNow, formData: body } = latest.current;
      dispatch(
        setTimeRangeCheck({
          key: checkKey,
          status: judgement.status,
          optionReasons,
          // Dates as the server sent them, so the store stays serializable.
          failures: judgement.failures.map(
            ({ bound: _bound, ...rest }) => rest,
          ),
          ...timeRangeCheckErrors(judgement.failures, {
            controls: controlsNow,
            formData: body,
          }),
        }),
      );
      return;
    }
    dispatch(
      setTimeRangeCheck({
        key: checkKey,
        status: judgement.status,
        ...(judgement.status === 'valid' && { optionReasons }),
      }),
    );
  }, [
    enabled,
    answer,
    checkKey,
    policy,
    dashboard,
    dashboardId,
    datasetName,
    dispatch,
  ]);

  return useCallback(() => {
    refreshedFor.current = null;
    setAttempt(previous => previous + 1);
  }, []);
}
