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
import { useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  FeatureFlag,
  isFeatureEnabled,
  type JsonObject,
  type QueryFormData,
} from '@superset-ui/core';
import {
  chartHoldMode,
  chartSignature,
  checkChartRanges,
  noteChartRejection,
} from 'src/dashboard/actions/timeRangeLimits';
import type { RootState } from 'src/dashboard/types';
import type { ChartState } from 'src/explore/types';

export type HeldView = 'loading' | 'waiting' | null;

/**
 * Holds a dashboard chart's query until the time range limits check lets
 * its date ranges run, and says what the chart shows meanwhile.
 */
export default function useChartTimeRangeHold({
  chartId,
  chart,
  formData,
  ownState,
}: {
  chartId: number;
  chart: ChartState | undefined;
  formData: QueryFormData;
  ownState: JsonObject;
}) {
  const dispatch = useDispatch();
  const chartStatus = chart?.chartStatus;
  const queriesResponse = chart?.queriesResponse;
  const holdMode = useSelector((state: RootState) =>
    chartHoldMode(state.timeRangeLimits),
  );
  const chartHold = useSelector(
    (state: RootState) => state.timeRangeLimits?.charts[chartId],
  );
  const signature = useMemo(
    () => (holdMode === 'off' ? '' : chartSignature(formData)),
    [holdMode, formData],
  );
  const triggerQuery = chart?.triggerQuery;

  useEffect(() => {
    if (holdMode === 'on' && triggerQuery) {
      dispatch(checkChartRanges(chartId, formData, ownState));
    }
    // The signature stands for the form data, so an equal copy is not checked again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, holdMode, triggerQuery, signature, chartId]);

  useEffect(() => {
    if (
      isFeatureEnabled(FeatureFlag.TimeRangeLimits) &&
      chartStatus === 'failed'
    ) {
      dispatch(noteChartRejection(chartId));
    }
  }, [dispatch, holdMode, chartStatus, queriesResponse, chartId]);

  const currentHold =
    chartHold?.signature === signature ? chartHold : undefined;
  let heldView: HeldView = null;
  if (holdMode !== 'off') {
    if (
      currentHold?.status === 'invalid' ||
      currentHold?.status === 'unbounded'
    ) {
      heldView = 'waiting';
    } else if (
      triggerQuery &&
      (holdMode === 'failed' || currentHold?.status === 'unavailable')
    ) {
      heldView = 'waiting';
    } else if (
      triggerQuery &&
      (holdMode === 'loading' ||
        !currentHold ||
        currentHold.status === 'checking')
    ) {
      heldView = 'loading';
    }
  }
  // A chart already on screen stays mounted while it is checked, so the
  // dashboard's keep-on-screen refresh can draw over it once the query runs.
  // Asking a chart to run again sets its status to 'loading', so the status
  // it last settled on decides whether it is on screen.
  const lastSettledStatus = useRef(chartStatus);
  useEffect(() => {
    if (chartStatus !== 'loading') {
      lastSettledStatus.current = chartStatus;
    }
  }, [chartStatus]);
  const settledStatus =
    chartStatus === 'loading' ? lastSettledStatus.current : chartStatus;
  const hasChartOnScreen =
    !!queriesResponse &&
    (settledStatus === 'rendered' || settledStatus === 'success');
  const showHeldPlaceholder =
    heldView === 'waiting' || (heldView === 'loading' && !hasChartOnScreen);
  const releasedTriggerQuery =
    holdMode === 'off'
      ? triggerQuery
      : Boolean(
          triggerQuery && holdMode === 'on' && currentHold?.status === 'valid',
        );

  return {
    heldView,
    hasChartOnScreen,
    showHeldPlaceholder,
    releasedTriggerQuery,
  };
}
