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
import { useCallback, useEffect, useMemo } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import {
  FeatureFlag,
  isFeatureEnabled,
  type TimeRangeLimits,
} from '@superset-ui/core';
import { dashboardLimitLevels } from 'src/utils/timeRangeLimits';
import { fetchTimeRangeLimits } from 'src/dashboard/actions/timeRangeLimits';
import type { RootState } from 'src/dashboard/types';

export type DashboardTimeRangeLimitsStatus =
  | { status: 'off' }
  | { status: 'loading'; afterFailed?: boolean }
  | { status: 'loaded'; limits: TimeRangeLimits }
  | { status: 'failed' };

export type DashboardTimeRangeLimitsState = DashboardTimeRangeLimitsStatus & {
  retry: () => void;
};

/**
 * The dashboard's time range limits, as the dashboard holds them in the
 * Redux store (flag on only); the slice is loaded here only when it holds no
 * load of this dashboard yet. Any error or no answer in 10 s gives `failed`;
 * only `retry()` asks again.
 */
export default function useDashboardTimeRangeLimits(
  dashboardId: number,
): DashboardTimeRangeLimitsState {
  const dispatch = useDispatch();
  const flagOn = isFeatureEnabled(FeatureFlag.TimeRangeLimits);
  const {
    status,
    payload,
    failedBefore,
    dashboardId: loadedId,
  } = useSelector(
    (state: RootState) => ({
      status: state.timeRangeLimits.status,
      payload: state.timeRangeLimits.payload,
      failedBefore: state.timeRangeLimits.failedBefore,
      dashboardId: state.timeRangeLimits.dashboardId,
    }),
    shallowEqual,
  );
  const started = loadedId === dashboardId && status !== 'off';

  useEffect(() => {
    if (flagOn && !started) {
      dispatch(fetchTimeRangeLimits(dashboardId));
    }
  }, [dispatch, flagOn, started, dashboardId]);

  const retry = useCallback(() => {
    dispatch(fetchTimeRangeLimits(dashboardId));
  }, [dispatch, dashboardId]);

  return useMemo((): DashboardTimeRangeLimitsState => {
    if (!flagOn) {
      return { status: 'off', retry };
    }
    if (!started || status === 'loading') {
      return {
        status: 'loading',
        ...(started && failedBefore ? { afterFailed: true } : {}),
        retry,
      };
    }
    if (status === 'failed' || !payload) {
      return { status: 'failed', retry };
    }
    return {
      status: 'loaded',
      limits: {
        levels: dashboardLimitLevels(payload),
        dashboardId,
        timezone: payload.timezone,
      },
      retry,
    };
  }, [flagOn, started, status, payload, failedBefore, dashboardId, retry]);
}
