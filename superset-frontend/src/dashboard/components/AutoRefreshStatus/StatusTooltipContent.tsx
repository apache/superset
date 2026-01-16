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
import { FC } from 'react';
import { t } from '@superset-ui/core';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import { AutoRefreshStatus } from '../../types/autoRefresh';

export interface StatusTooltipContentProps {
  status: AutoRefreshStatus;
  lastSuccessfulRefresh: number | null;
  lastError: string | null;
  refreshFrequency: number;
  autoRefreshFetchStartTime: number | null;
  isPausedByTab?: boolean;
}

/**
 * Formats a timestamp for display in the tooltip.
 * Shows relative time ("3 s ago").
 */
const formatTimestamp = (timestamp: number | null): string => {
  if (!timestamp) {
    return t('Never');
  }
  return extendedDayjs(timestamp).fromNow();
};

/**
 * Get the status-specific message for the tooltip.
 *
 * Per designer screenshot, tooltip shows two lines:
 * - Line 1: "Dashboard updated X ago"
 * - Line 2: "Auto refresh set to X seconds"
 */
const getStatusMessage = (
  status: AutoRefreshStatus,
  lastSuccessfulRefresh: number | null,
  lastError: string | null,
  refreshFrequency: number,
  autoRefreshFetchStartTime: number | null,
  isPausedByTab: boolean,
): { line1: string; line2: string; line3?: string } => {
  const intervalLine = t('Auto refresh set to %s seconds', refreshFrequency);

  switch (status) {
    case AutoRefreshStatus.Fetching:
      return {
        line1: t('Fetching data...'),
        line2: intervalLine,
      };
    case AutoRefreshStatus.Delayed: {
      const fetchElapsed = autoRefreshFetchStartTime
        ? Math.round((Date.now() - autoRefreshFetchStartTime) / 1000)
        : null;
      return {
        line1: t(
          'Dashboard updated %s',
          formatTimestamp(lastSuccessfulRefresh),
        ),
        line2: intervalLine,
        line3: fetchElapsed
          ? t('Refresh taking longer than expected (%ss)', fetchElapsed)
          : t('Refresh delayed'),
      };
    }
    case AutoRefreshStatus.Error:
      return {
        line1: t(
          'Dashboard updated %s',
          formatTimestamp(lastSuccessfulRefresh),
        ),
        line2: intervalLine,
        line3: lastError ? t('Error: %s', lastError) : t('Refresh failed'),
      };
    case AutoRefreshStatus.Paused:
      return {
        line1: isPausedByTab
          ? t('Auto-refresh paused (tab inactive)')
          : t('Auto-refresh paused'),
        line2: intervalLine,
      };
    case AutoRefreshStatus.Success:
    case AutoRefreshStatus.Idle:
    default:
      return {
        line1: t(
          'Dashboard updated %s',
          formatTimestamp(lastSuccessfulRefresh),
        ),
        line2: intervalLine,
      };
  }
};

export const StatusTooltipContent: FC<StatusTooltipContentProps> = ({
  status,
  lastSuccessfulRefresh,
  lastError,
  refreshFrequency,
  autoRefreshFetchStartTime,
  isPausedByTab = false,
}) => {
  const { line1, line2, line3 } = getStatusMessage(
    status,
    lastSuccessfulRefresh,
    lastError,
    refreshFrequency,
    autoRefreshFetchStartTime,
    isPausedByTab,
  );

  return (
    <div data-test="status-tooltip-content">
      <div>{line1}</div>
      <div>{line2}</div>
      {line3 && <div>{line3}</div>}
    </div>
  );
};

export default StatusTooltipContent;
