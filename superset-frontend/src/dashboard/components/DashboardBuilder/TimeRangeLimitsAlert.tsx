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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { isEqual } from 'lodash-es';
import { t } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import {
  ErrorTypeEnum,
  NO_TIME_RANGE,
  type Filter,
  type JsonObject,
  type TimeRangeLimits,
} from '@superset-ui/core';
import { Button, Flex } from '@superset-ui/core/components';
import { RootState } from 'src/dashboard/types';
import { updateDataMask } from 'src/dataMask/actions';
import { logEvent } from 'src/logger/actions';
import { LOG_ACTIONS_CHANGE_DASHBOARD_FILTER } from 'src/logger/LogUtils';
import { setDirectPathToChild } from 'src/dashboard/actions/dashboardState';
import { refreshChart } from 'src/components/Chart/chartAction';
import {
  chartHoldMode,
  fetchTimeRangeLimits,
  setTimeRangeUserApply,
  type ChartHoldMode,
} from 'src/dashboard/actions/timeRangeLimits';
import type {
  ChartHold,
  TimeRangeUserApply,
} from 'src/dashboard/reducers/timeRangeLimits';
import {
  bindingSpan,
  checkTimeRange,
  describeLimit,
  isSubDay,
  type LimitCheck,
  type LimitFailure,
} from 'src/utils/timeRangeLimits';
import { limitAlertIcon } from 'src/components/TimeRangeLimits/limitAlertIcon';
import {
  selectFilterTimeRangeLimits,
  selectServerMarks,
  selectTimeRangeLimitsMode,
  stripLimitFlags,
  type ServerMark,
} from 'src/dashboard/components/nativeFilters/FilterBar/utils';
import { limitsUnavailableMessage } from 'src/dashboard/components/nativeFilters/utils';

type FilterLimits = {
  id: string;
  value: string;
  limits: TimeRangeLimits;
};

type Problem =
  | { kind: 'filter'; filterId: string; message: string }
  | { kind: 'chart'; message: string };

type UseLast = { value: string; label: string };

const HELD: ChartHold['status'][] = ['invalid', 'unbounded', 'rejected'];
const FOCUS_TRIES = 50;

export const LIMITS_FAILED_TEXT_ID = 'time-range-limits-failed-text';
export const LIMITS_ALERT_TEXT_ID = 'time-range-limits-alert-text';

const describeBound = (limit: NonNullable<LimitFailure['limit']>) => {
  if (limit.quantity !== 0) {
    return describeLimit(limit);
  }
  return isSubDay(limit.time_grain) ? t('now') : t('today');
};

/** The alert's sentence for a range's first failure. */
export function limitAlertMessage(failure: LimitFailure): string {
  const limit = failure.limit ? describeBound(failure.limit) : '';
  switch (failure.reason) {
    case 'MAX_SPAN_EXCEEDED':
      return t(
        'This link opened a time range longer than this dashboard allows (%(limit)s).',
        { limit },
      );
    case 'UNBOUNDED_RANGE':
      return t('This link opened a time range with no start or end date.');
    case 'MAX_LOOK_BACK_EXCEEDED':
      return t(
        'This link opened a time range that starts earlier than this dashboard allows (%(limit)s).',
        { limit },
      );
    case 'MAX_LOOK_FORWARD_EXCEEDED':
      return t(
        'This link opened a time range that ends later than this dashboard allows (%(limit)s).',
        { limit },
      );
    default:
      return failure.message;
  }
}

/** The alert's sentence for the first failure of a chart's own range. */
export function chartAlertMessage(failure: LimitFailure): string {
  const limit = failure.limit ? describeBound(failure.limit) : '';
  switch (failure.reason) {
    case 'MAX_SPAN_EXCEEDED':
      return t(
        'A chart on this dashboard uses a time range longer than this dashboard allows (%(limit)s).',
        { limit },
      );
    case 'UNBOUNDED_RANGE':
      return t(
        'This chart requires a bounded time range. Ask a dashboard editor to add or scope a time range filter.',
      );
    case 'MAX_LOOK_BACK_EXCEEDED':
      return t(
        'A chart on this dashboard uses a time range that starts earlier than this dashboard allows (%(limit)s).',
        { limit },
      );
    case 'MAX_LOOK_FORWARD_EXCEEDED':
      return t(
        'A chart on this dashboard uses a time range that ends later than this dashboard allows (%(limit)s).',
        { limit },
      );
    default:
      return failure.message;
  }
}

const checkMessage = (check: LimitCheck): string | undefined => {
  if (check.status === 'error') {
    return check.message;
  }
  if (check.status === 'unavailable') {
    return undefined;
  }
  const [failure] = check.failures;
  return failure ? limitAlertMessage(failure) : undefined;
};

/**
 * The picker's "Last" form of the span limit that binds a range ending today
 * (sub-day limits end now), e.g. `DATEADD(DATETIME("today"), -90, day) : today`.
 */
export function lastRangeValue(check: LimitCheck): UseLast | null {
  if (check.status !== 'checked') {
    return null;
  }
  const binding = bindingSpan(check.today, check.limits.maxSpan);
  if (!binding) {
    return null;
  }
  const { limit } = binding;
  const anchor = limit.subDay ? 'now' : 'today';
  return {
    value: `DATEADD(DATETIME("${anchor}"), -${limit.count * limit.quantity}, ${limit.unit}) : ${anchor}`,
    label: describeLimit(limit),
  };
}

const passes = (check: LimitCheck) =>
  check.status === 'checked' && !check.failures.length;

const selectFilterLimits = (state: RootState): FilterLimits[] =>
  Object.values(state.nativeFilters?.filters ?? {})
    .filter(
      (filter): filter is Filter =>
        (filter as Filter).filterType === 'filter_time',
    )
    .flatMap(filter => {
      const limits = selectFilterTimeRangeLimits(state, filter.chartsInScope);
      return limits
        ? [
            {
              id: filter.id,
              value:
                state.dataMask[filter.id]?.filterState?.value || NO_TIME_RANGE,
              limits,
            },
          ]
        : [];
    });

const selectFirstHeldChart = (state: RootState): ChartHold | undefined =>
  selectTimeRangeLimitsMode(state) === 'on'
    ? Object.values(state.timeRangeLimits.charts).find(
        hold => HELD.includes(hold.status) && hold.failures?.length,
      )
    : undefined;

const selectUnavailableCharts = (state: RootState): number[] =>
  selectTimeRangeLimitsMode(state) === 'on'
    ? Object.entries(state.timeRangeLimits.charts)
        .filter(([, hold]) => hold.status === 'unavailable')
        .map(([id]) => Number(id))
    : [];

const selectChartsChecking = (state: RootState): boolean =>
  Object.values(state.timeRangeLimits.charts).some(
    hold => hold.status === 'checking',
  );

const limitRejected = (chart: RootState['charts'][number]) =>
  chart.chartStatus === 'failed' &&
  (chart.queriesResponse?.[0] as JsonObject | undefined)?.errors?.[0]
    ?.error_type === ErrorTypeEnum.TIME_RANGE_LIMIT_ERROR;

/**
 * Whether every chart the user's Apply ran has its answer: none waits for its
 * check or its request, and no time range rejection is still to be noted.
 */
const selectChartsSettled = (state: RootState): boolean => {
  const { charts } = state.timeRangeLimits;
  return (
    !Object.values(charts).some(
      hold => hold.status === 'checking' || hold.status === 'valid',
    ) &&
    !Object.entries(state.charts ?? {}).some(
      ([id, chart]) =>
        chart.chartStatus === 'loading' ||
        (limitRejected(chart) && charts[Number(id)]?.status !== 'rejected'),
    )
  );
};

/**
 * The dashboard's time range limit alert: the limits-failed error with Retry when the
 * limits can't be loaded, and a warning while a Time Range filter's
 * applied value or a chart's own range breaks them. Only a filter's value
 * gets "Use last …" and "Pick a range". Focus moves at most once per page
 * load: when the first judgement settles with a problem.
 */
export default function TimeRangeLimitsAlert({
  filterBarOpen,
}: {
  filterBarOpen: boolean;
}) {
  const dispatch = useDispatch();
  const mode = useSelector<RootState, ChartHoldMode>(selectTimeRangeLimitsMode);
  const dashboardId = useSelector<RootState, number>(
    state => state.dashboardInfo.id,
  );
  const filterLimits = useSelector<RootState, FilterLimits[]>(
    selectFilterLimits,
    isEqual,
  );
  const serverMarks = useSelector<RootState, Record<string, ServerMark>>(
    selectServerMarks,
    isEqual,
  );
  const heldChart = useSelector<RootState, ChartHold | undefined>(
    selectFirstHeldChart,
    isEqual,
  );
  const chartsChecking = useSelector<RootState, boolean>(selectChartsChecking);
  const unavailableCharts = useSelector<RootState, number[]>(
    selectUnavailableCharts,
    isEqual,
  );
  const chartsSettled = useSelector<RootState, boolean>(selectChartsSettled);
  const userApply = useSelector<RootState, TimeRangeUserApply | undefined>(
    state => state.timeRangeLimits.userApply,
  );

  const [checks, setChecks] = useState<Record<string, LimitCheck>>({});
  useEffect(() => {
    if (!filterLimits.length) {
      return undefined;
    }
    let current = true;
    Promise.all(
      filterLimits.map(({ value, limits }) =>
        checkTimeRange(value, limits.levels),
      ),
    ).then(results => {
      if (current) {
        setChecks(
          Object.fromEntries(
            filterLimits.map(({ id }, index) => [id, results[index]]),
          ),
        );
      }
    });
    return () => {
      current = false;
    };
  }, [filterLimits]);

  // The value each filter had when its limits first arrived after the last
  // hydration (a link, the URL state, a permalink or the saved default), and
  // whether the filter still has it. Once changed, it stays changed.
  const hydrations = useSelector<RootState, number>(
    state => state.timeRangeLimits.hydrations ?? 0,
  );
  const loaded = useRef<{
    hydrations: number;
    filters: Record<string, { value: string; kept: boolean }>;
  }>({ hydrations, filters: {} });
  if (loaded.current.hydrations !== hydrations) {
    loaded.current = { hydrations, filters: {} };
  }
  filterLimits.forEach(({ id, value }) => {
    const record = loaded.current.filters[id];
    if (!record) {
      loaded.current.filters[id] = { value, kept: true };
    } else if (record.value !== value) {
      record.kept = false;
    }
  });

  const invalidFilters = useMemo(
    () =>
      filterLimits.flatMap(filter => {
        const check = checks[filter.id];
        if (!check || check.timeRange !== filter.value) {
          return [];
        }
        const message =
          (loaded.current.filters[filter.id]?.kept
            ? checkMessage(check)
            : undefined) ??
          (serverMarks[filter.id]
            ? limitAlertMessage(serverMarks[filter.id].failure)
            : undefined);
        return message ? [{ ...filter, check, message }] : [];
      }),
    [checks, filterLimits, hydrations, serverMarks],
  );

  const filterChecksPending = filterLimits.some(
    ({ id, value }) => checks[id]?.timeRange !== value,
  );

  let problem: Problem | null = null;
  if (mode === 'on' && invalidFilters.length) {
    problem = {
      kind: 'filter',
      filterId: invalidFilters[0].id,
      message: invalidFilters[0].message,
    };
  } else if (
    mode === 'on' &&
    !filterChecksPending &&
    heldChart?.failures?.length
  ) {
    problem = {
      kind: 'chart',
      message: chartAlertMessage(heldChart.failures[0]),
    };
  }

  const candidate = invalidFilters.length
    ? lastRangeValue(invalidFilters[0].check)
    : null;
  const useLastKey = JSON.stringify([
    candidate,
    invalidFilters.map(({ id, limits }) => [id, limits.levels]),
  ]);
  const [useLast, setUseLast] = useState<{
    key: string;
    shown: UseLast | null;
  }>();
  useEffect(() => {
    if (!candidate) {
      setUseLast({ key: useLastKey, shown: null });
      return undefined;
    }
    let current = true;
    Promise.all(
      invalidFilters.map(({ limits }) =>
        checkTimeRange(candidate.value, limits.levels),
      ),
    ).then(results => {
      if (current) {
        setUseLast({
          key: useLastKey,
          shown: results.every(passes) ? candidate : null,
        });
      }
    });
    return () => {
      current = false;
    };
    // The key holds the candidate and every invalid filter's levels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useLastKey]);
  const useLastSettled = useLast?.key === useLastKey;
  const shownUseLast = useLastSettled ? useLast?.shown : null;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const focused = useRef(false);
  const [retrying, setRetrying] = useState(false);
  const retryLoaded = useRef(false);
  const retryFocus = useRef(false);
  useEffect(() => {
    if (!retrying) {
      return;
    }
    if (mode === 'loading') {
      retryLoaded.current = true;
      return;
    }
    if (retryLoaded.current) {
      retryLoaded.current = false;
      setRetrying(false);
      retryFocus.current = mode === 'on';
    }
  }, [mode, retrying]);
  const [rechecking, setRechecking] = useState(false);
  const focusTimer = useRef<ReturnType<typeof setInterval>>();

  const filterReachable = (filterId: string) =>
    filterBarOpen &&
    document.getElementById(`filter-name-${filterId}`) !== null;

  // An alert without buttons (a chart's own range) has no field to fix, so
  // focus stays put and its live region announces it.
  const focusAlert = () => {
    wrapperRef.current?.querySelector<HTMLElement>('button')?.focus();
  };

  const pickRange = (filterId: string) => {
    if (filterBarOpen) {
      dispatch(setDirectPathToChild([filterId]));
    } else {
      focusAlert();
    }
  };

  // A time range problem after the user's own Apply or "Use last …" moves
  // focus once to the filter; nothing else after the load's first judgement.
  useEffect(() => {
    if (!userApply || mode !== 'on' || filterChecksPending) {
      return;
    }
    const target = invalidFilters.find(
      ({ id, value }) => userApply.filters[id] === value,
    );
    if (!target) {
      if (userApply.started && chartsSettled) {
        dispatch(setTimeRangeUserApply(null));
      }
      return;
    }
    if (!useLastSettled || !focused.current) {
      return;
    }
    dispatch(setTimeRangeUserApply(null));
    if (filterBarOpen) {
      dispatch(setDirectPathToChild([target.id]));
    } else {
      focusAlert();
    }
  });

  useEffect(() => {
    if (focused.current || mode !== 'on' || filterChecksPending) {
      return;
    }
    if (!problem) {
      if (!chartsChecking) {
        focused.current = true;
      }
      return;
    }
    if (problem.kind === 'filter' && !useLastSettled) {
      return;
    }
    focused.current = true;
    retryFocus.current = false;
    if (userApply) {
      dispatch(setTimeRangeUserApply(null));
    }
    if (problem.kind !== 'filter' || !filterBarOpen) {
      focusAlert();
      return;
    }
    // The open bar lists its filters after its own start; wait for this one.
    const { filterId: target } = problem;
    let tries = 0;
    focusTimer.current = setInterval(() => {
      tries += 1;
      if (filterReachable(target)) {
        clearInterval(focusTimer.current);
        dispatch(setDirectPathToChild([target]));
      } else if (tries >= FOCUS_TRIES) {
        clearInterval(focusTimer.current);
        focusAlert();
      }
    }, 100);
  });

  // After a Retry that loads the limits, focus goes to the first Time Range
  // filter, else the alert, once the load's first judgement has settled.
  useEffect(() => {
    if (
      !retryFocus.current ||
      mode !== 'on' ||
      filterChecksPending ||
      (problem?.kind === 'filter' ? !useLastSettled : chartsChecking)
    ) {
      return;
    }
    retryFocus.current = false;
    if (document.activeElement && document.activeElement !== document.body) {
      return;
    }
    if (filterBarOpen && filterLimits.length) {
      dispatch(setDirectPathToChild([filterLimits[0].id]));
    } else if (problem) {
      focusAlert();
    }
  });

  useEffect(() => () => clearInterval(focusTimer.current), []);

  const retry = () => {
    if (unavailableCharts.length) {
      setRechecking(true);
      (dispatch(fetchTimeRangeLimits(dashboardId)) as unknown as Promise<void>)
        .then(() =>
          dispatch(((
            next: (action: unknown) => unknown,
            getState: () => RootState,
          ) =>
            chartHoldMode(getState().timeRangeLimits) === 'on'
              ? Promise.all(
                  unavailableCharts
                    .filter(
                      chartId =>
                        getState().timeRangeLimits.charts[chartId]?.status ===
                        'unavailable',
                    )
                    .map(chartId =>
                      next(refreshChart(chartId, false, dashboardId)),
                    ),
                )
              : undefined) as never),
        )
        .finally(() => setRechecking(false));
      return;
    }
    setRetrying(true);
    dispatch(fetchTimeRangeLimits(dashboardId));
  };

  const applyUseLast = (value: string) => {
    dispatch(logEvent(LOG_ACTIONS_CHANGE_DASHBOARD_FILTER, {}));
    dispatch(
      setTimeRangeUserApply(
        Object.fromEntries(invalidFilters.map(({ id }) => [id, value])),
      ),
    );
    invalidFilters.forEach(({ id }) => {
      dispatch(
        updateDataMask(
          id,
          stripLimitFlags({
            extraFormData: { time_range: value },
            filterState: { value },
          }),
        ),
      );
    });
  };

  if (
    mode === 'failed' ||
    unavailableCharts.length > 0 ||
    (retrying && mode === 'loading') ||
    rechecking
  ) {
    return (
      <Alert
        type="error"
        icon={limitAlertIcon('error')}
        closable={false}
        showIcon
        action={
          <Button
            buttonSize="small"
            loading={retrying || rechecking}
            onClick={retry}
          >
            {t('Retry')}
          </Button>
        }
      >
        <span id={LIMITS_FAILED_TEXT_ID}>{limitsUnavailableMessage()}</span>
      </Alert>
    );
  }

  if (!problem) {
    return null;
  }

  const { filterId } = problem.kind === 'filter' ? problem : { filterId: '' };
  return (
    <div ref={wrapperRef} data-test="time-range-limits-alert">
      <Alert
        type="warning"
        banner
        icon={limitAlertIcon('warning')}
        closable={false}
        showIcon
        action={
          problem.kind === 'filter' ? (
            <Flex gap="small">
              {shownUseLast && (
                <Button
                  buttonSize="small"
                  onClick={() => applyUseLast(shownUseLast.value)}
                >
                  {t('Use last %(limit)s', { limit: shownUseLast.label })}
                </Button>
              )}
              <Button
                buttonStyle="link"
                buttonSize="small"
                onClick={() => pickRange(filterId)}
              >
                {t('Pick a range')}
              </Button>
            </Flex>
          ) : undefined
        }
      >
        <span id={LIMITS_ALERT_TEXT_ID}>{problem.message}</span>
      </Alert>
    </div>
  );
}
