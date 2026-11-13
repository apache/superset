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
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import {
  ensureIsArray,
  ErrorTypeEnum,
  type Level,
  type TimeRangeLimits,
} from '@superset-ui/core';
import type { ControlStateMapping } from '@superset-ui/chart-controls';
import {
  ExploreTimeRangeCheck,
  ExploreTimeRangeLimits,
  exploreLimitsOn,
  exploreRunAllowed,
  exploreRunRefused,
  limitsFailed,
  timeRangeCheckKey,
} from 'src/explore/actions/timeRangeLimitsActions';
import { createOwnStateWithChartState } from 'src/dashboard/util/chartStateConverter';
import { ExploreTimeRangeLimitsContext } from 'src/explore/components/controls/DateFilterControl/ExploreTimeRangeLimitsContext';
import type { ExploreState } from 'src/explore/reducers/exploreReducer';
import { hasLimits } from 'src/utils/timeRangeLimits';
import {
  TIME_RANGE_FAILED_TEXT_ID,
  TIME_RANGE_REASON_ID,
} from '../ExploreChartPanel/useTimeRangeAlert';
import useExploreTimeRangeCheck from './useExploreTimeRangeCheck';
import type { ExploreViewContainerProps } from '.';

/**
 * The time range limits guard of Explore's runs: whether a run may start
 * now, and the request key the checks are made for.
 */
export function useExploreLimitsRun(props: ExploreViewContainerProps) {
  const limitsOn = exploreLimitsOn(props.timeRangeLimits, props.dashboardId);
  const checkKey = useMemo(
    () =>
      limitsOn
        ? timeRangeCheckKey(props.controls, props.ownState, props.dashboardId)
        : '',
    [limitsOn, props.controls, props.ownState, props.dashboardId],
  );
  const queryFormData = useMemo(
    () =>
      limitsOn && props.dashboardId !== undefined
        ? { ...props.form_data, dashboardId: props.dashboardId }
        : props.form_data,
    [limitsOn, props.form_data, props.dashboardId],
  );
  const chartState = useSelector(
    (state: { explore?: ExploreState }) =>
      state.explore?.chartStates?.[props.chart.id],
  );
  const retryTimeRangeCheck = useExploreTimeRangeCheck({
    enabled: limitsOn,
    checkKey,
    formData: queryFormData,
    ownState: createOwnStateWithChartState(
      props.ownState || {},
      chartState,
      props.vizType ?? '',
    ),
    force: props.force,
    controls: props.controls,
    limits: props.timeRangeLimits,
    datasetName:
      props.datasource.datasource_name ?? props.datasource.name ?? '',
  });
  // The guards read the request at call time, not the last render's key.
  const currentCheckKey = () =>
    timeRangeCheckKey(props.controls, props.ownState, props.dashboardId);
  const isQueryAllowed = () =>
    !limitsOn ||
    exploreRunAllowed(
      props.timeRangeLimits,
      props.timeRangeCheck,
      currentCheckKey(),
    );
  // The request key of the last run the user started (Update chart,
  // Ctrl+Enter), until its answer.
  const userRunKeyRef = useRef<string | null>(null);
  const requestFocus = (check: ExploreTimeRangeCheck | undefined) => {
    const controls = Object.keys(check?.controlErrors ?? {});
    if (controls.length) {
      props.actions.requestTimeRangeFocus(controls);
    }
  };

  /** Whether a run waits for the check; a run the check may still allow runs once it does. */
  const holdRun = () => {
    if (isQueryAllowed()) {
      return false;
    }
    if (!exploreRunRefused(props.timeRangeCheck, currentCheckKey())) {
      props.actions.setTimeRangeRunOnValid('query');
    }
    return true;
  };

  /** Ctrl+Enter: focus the refused control, or note the user's run. */
  const noteRunShortcut = (
    hasControlErrors: boolean,
    isChartLoading: boolean,
  ) => {
    if (!limitsOn) {
      return;
    }
    const key = currentCheckKey();
    if (exploreRunRefused(props.timeRangeCheck, key)) {
      requestFocus(props.timeRangeCheck);
    } else if (!hasControlErrors && !isChartLoading) {
      userRunKeyRef.current = key;
    }
  };

  return {
    limitsOn,
    checkKey,
    queryFormData,
    retryTimeRangeCheck,
    currentCheckKey,
    isQueryAllowed,
    userRunKeyRef,
    requestFocus,
    holdRun,
    noteRunShortcut,
  };
}

type LimitsRun = ReturnType<typeof useExploreLimitsRun>;

/** The runs the user starts, noted so a rejection can move focus. */
export function useExploreUserRuns({
  props,
  run,
  onQuery,
}: {
  props: ExploreViewContainerProps;
  run: LimitsRun;
  onQuery: () => void;
}) {
  const { userRunKeyRef, currentCheckKey } = run;
  const onUserQuery = useCallback(() => {
    userRunKeyRef.current = currentCheckKey();
    onQuery();
  }, [onQuery, props.controls, props.ownState, props.dashboardId]);

  const onUserCachedQuery = useCallback(
    (...args: Parameters<typeof props.actions.postChartFormData>) => {
      userRunKeyRef.current = currentCheckKey();
      return props.actions.postChartFormData(...args);
    },
    [props.actions, props.controls, props.ownState, props.dashboardId],
  );
  return { onUserQuery, onUserCachedQuery };
}

/**
 * Runs the run that waited for the check once it allows it, and after a
 * time range rejection of the user's run, moves focus to the first control
 * the re-check marks, unless a control changed or the user types.
 */
export function useExploreRunOnValid({
  props,
  run,
  hasControlErrors,
  onQuery,
  setLastQueriedControls,
}: {
  props: ExploreViewContainerProps;
  run: LimitsRun;
  hasControlErrors: boolean;
  onQuery: () => void;
  setLastQueriedControls: (controls: ControlStateMapping) => void;
}) {
  const {
    limitsOn,
    checkKey,
    currentCheckKey,
    isQueryAllowed,
    userRunKeyRef,
    requestFocus,
  } = run;

  useEffect(() => {
    const runOnValid = props.timeRangeRunOnValid;
    if (!runOnValid) {
      return;
    }
    if (
      limitsOn &&
      exploreRunRefused(props.timeRangeCheck, currentCheckKey())
    ) {
      props.actions.setTimeRangeRunOnValid(null);
      return;
    }
    if (hasControlErrors) {
      if (runOnValid === 'query') {
        props.actions.setTimeRangeRunOnValid(null);
      }
      return;
    }
    if (!isQueryAllowed()) {
      return;
    }
    props.actions.setTimeRangeRunOnValid(null);
    if (runOnValid === 'query') {
      onQuery();
    } else {
      props.actions.triggerQuery(true, props.chart.id);
      setLastQueriedControls(props.controls);
    }
  }, [
    limitsOn,
    hasControlErrors,
    props.timeRangeRunOnValid,
    props.timeRangeCheck,
    props.timeRangeLimits,
  ]);

  const limitRejection =
    !!props.timeRangeLimits &&
    props.chart.chartStatus === 'failed' &&
    ensureIsArray(props.chart.queriesResponse).some(response =>
      ensureIsArray(
        (response as { errors?: { error_type?: string }[] } | null)?.errors,
      ).some(
        error => error?.error_type === ErrorTypeEnum.TIME_RANGE_LIMIT_ERROR,
      ),
    );
  const rejectionFocus = useRef<{ key: string; refreshed: boolean } | null>(
    null,
  );
  const [refusedKey, setRefusedKey] = useState<string | null>(null);
  useEffect(() => {
    if (limitRejection) {
      props.actions.refreshExploreTimeRangeLimits();
      const key = currentCheckKey();
      setRefusedKey(key);
      if (limitsOn && userRunKeyRef.current === key) {
        rejectionFocus.current = { key, refreshed: false };
      }
    }
    userRunKeyRef.current = null;
  }, [props.chart.queriesResponse]);
  useEffect(() => {
    const pending = rejectionFocus.current;
    if (!pending) {
      return;
    }
    if (!limitsOn || pending.key !== checkKey) {
      rejectionFocus.current = null;
      return;
    }
    const check = props.timeRangeCheck;
    if (
      props.timeRangeLimits?.refreshing ||
      check?.key !== checkKey ||
      check.status === 'pending'
    ) {
      pending.refreshed = true;
      return;
    }
    if (!pending.refreshed) {
      return;
    }
    rejectionFocus.current = null;
    const active = document.activeElement;
    if (
      exploreRunRefused(check, checkKey) &&
      !active?.matches('input, textarea') &&
      !active?.closest('[contenteditable=""], [contenteditable="true"]')
    ) {
      requestFocus(check);
    }
  }, [limitsOn, checkKey, props.timeRangeCheck, props.timeRangeLimits]);

  return { limitRejection, refusedKey };
}

/**
 * What the Run and Save buttons and the chart area say while the limits
 * hold a run, and the Retry of a failed load or check.
 */
export function useExploreTimeRangeStatus({
  props,
  run,
  rejection,
  errorMessage,
}: {
  props: ExploreViewContainerProps;
  run: LimitsRun;
  rejection: ReturnType<typeof useExploreRunOnValid>;
  errorMessage: ReactNode;
}) {
  const { limitsOn, checkKey, isQueryAllowed, retryTimeRangeCheck } = run;
  const { limitRejection, refusedKey } = rejection;
  const timeRangeFailed =
    limitsOn &&
    (limitsFailed(props.timeRangeLimits) ||
      (props.timeRangeCheck?.key === checkKey &&
        props.timeRangeCheck.status === 'unavailable'));
  const queryAllowed = isQueryAllowed();
  const timeRangeBusy =
    limitsOn &&
    !queryAllowed &&
    !timeRangeFailed &&
    !exploreRunRefused(props.timeRangeCheck, checkKey);
  const timeRangeBlock = useMemo(() => {
    if (queryAllowed) {
      return null;
    }
    if (timeRangeFailed) {
      return t(
        'Time range limits could not be loaded. Queries are paused to protect the database.',
      );
    }
    const buttonErrors = exploreRunRefused(props.timeRangeCheck, checkKey)
      ? (props.timeRangeCheck?.buttonErrors ?? [])
      : [];
    if (buttonErrors.length) {
      return (
        <div>
          {buttonErrors.map(message => (
            <div key={message}>{message}</div>
          ))}
        </div>
      );
    }
    return t('Loading...');
  }, [queryAllowed, timeRangeFailed, props.timeRangeCheck, checkKey]);
  const buttonErrorMessage = errorMessage || timeRangeBlock;

  // The chart area's reason: the first message of a check that refuses the
  // run, kept while the next check is pending.
  const checkPending =
    limitsOn &&
    (props.timeRangeCheck?.key !== checkKey ||
      props.timeRangeCheck.status === 'pending');
  const lastReason = useRef<string>();
  const reason =
    limitsOn && exploreRunRefused(props.timeRangeCheck, checkKey)
      ? (Object.values(props.timeRangeCheck?.controlErrors ?? {}).flat()[0] ??
        props.timeRangeCheck?.buttonErrors[0])
      : checkPending
        ? lastReason.current
        : undefined;
  lastReason.current = reason;
  const timeRangeReason =
    props.chart.chartStatus !== 'loading' ? reason : undefined;

  // The Retry alert stays, with a loading Retry, until the retry answers.
  const [retry, setRetry] = useState<'policy' | 'check' | null>(null);
  const retrySent = useRef(false);
  const runAfterRetry = useRef(false);
  const retryFocus = useRef(false);
  const checkRetrying = retry === 'check';
  const rejectionRetryShown =
    limitsOn &&
    limitRejection &&
    refusedKey === checkKey &&
    (retry === 'policy' || exploreRunRefused(props.timeRangeCheck, checkKey));
  const onTimeRangeRetry = useCallback(() => {
    if (limitsFailed(props.timeRangeLimits)) {
      setRetry('policy');
      props.actions.refreshExploreTimeRangeLimits();
    } else if (rejectionRetryShown) {
      runAfterRetry.current = true;
      setRetry('policy');
      props.actions.refreshExploreTimeRangeLimits();
    } else {
      setRetry('check');
      retryTimeRangeCheck();
    }
  }, [
    props.actions,
    props.timeRangeLimits,
    retryTimeRangeCheck,
    rejectionRetryShown,
  ]);
  useEffect(() => {
    if (!retry) {
      return;
    }
    if (
      retry === 'policy' ? !!props.timeRangeLimits?.refreshing : checkPending
    ) {
      retrySent.current = true;
      return;
    }
    if (retrySent.current) {
      retrySent.current = false;
      setRetry(null);
      retryFocus.current = !timeRangeFailed;
      if (runAfterRetry.current) {
        runAfterRetry.current = false;
        if (!timeRangeFailed) {
          props.actions.setTimeRangeRunOnValid('query');
        }
      }
    }
  }, [
    retry,
    checkPending,
    props.timeRangeLimits,
    timeRangeFailed,
    props.actions,
  ]);
  // After a retry that worked, focus goes to Update chart once the page has
  // run what the retry let through.
  useEffect(() => {
    if (
      !retryFocus.current ||
      props.timeRangeRunOnValid ||
      props.chart.chartStatus === 'loading' ||
      checkPending
    ) {
      return;
    }
    retryFocus.current = false;
    if (!document.activeElement || document.activeElement === document.body) {
      document
        .querySelector<HTMLElement>('[data-test="run-query-button"]')
        ?.focus();
    }
  });

  let timeRangeDescribedBy: string | undefined;
  if (limitsOn && buttonErrorMessage) {
    if (timeRangeFailed || checkRetrying) {
      timeRangeDescribedBy = TIME_RANGE_FAILED_TEXT_ID;
    } else if (timeRangeReason) {
      timeRangeDescribedBy = TIME_RANGE_REASON_ID;
    }
  }

  return {
    buttonErrorMessage,
    timeRangeBusy,
    timeRangeFailed,
    timeRangeReason,
    checkRetrying,
    rejectionRetryShown,
    onTimeRangeRetry,
    timeRangeDescribedBy,
  };
}

/**
 * The limits the Explore pickers apply: the policy levels, plus the
 * dashboard's once the check found that the server applies it.
 */
function explorePickerLimits(
  limits: ExploreTimeRangeLimits | undefined,
  dashboardId: number | undefined,
): TimeRangeLimits | undefined {
  if (!exploreLimitsOn(limits, dashboardId) || limits?.status !== 'loaded') {
    return undefined;
  }
  const { dashboard } = limits;
  const levels: Level[] = [
    ...limits.levels,
    ...(dashboard?.status === 'loaded'
      ? [{ source: 'dashboard' as const, policy: dashboard.policy }]
      : []),
  ];
  return hasLimits(levels) ? { levels, timezone: limits.timezone } : undefined;
}

/** Explore's limits reach only the pickers inside this page. */
export function ExploreTimeRangeLimitsProvider({
  timeRangeLimits,
  dashboardId,
  children,
}: {
  timeRangeLimits: ExploreTimeRangeLimits | undefined;
  dashboardId: number | undefined;
  children: ReactNode;
}) {
  const value = useMemo(
    () => explorePickerLimits(timeRangeLimits, dashboardId),
    [timeRangeLimits, dashboardId],
  );
  return (
    <ExploreTimeRangeLimitsContext.Provider value={value}>
      {children}
    </ExploreTimeRangeLimitsContext.Provider>
  );
}
