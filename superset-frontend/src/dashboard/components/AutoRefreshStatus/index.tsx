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
import { Tooltip } from '@superset-ui/core/components';
import { useRealTimeDashboard } from '../../hooks/useRealTimeDashboard';
import { StatusIndicatorDot } from './StatusIndicatorDot';
import { StatusTooltipContent } from './StatusTooltipContent';

export interface AutoRefreshStatusProps {
  /** Additional CSS class name */
  className?: string;
}

/**
 * Auto-refresh status indicator displayed in the dashboard header.
 * Only renders when the dashboard has an auto-refresh interval configured.
 *
 * Shows different colored dots based on refresh state:
 * - Green (success): Last refresh was successful
 * - Blue (fetching): Currently fetching data
 * - Yellow (delayed): Refresh is taking longer than expected
 * - Red (error): Refresh failed with an error
 * - White (paused): Auto-refresh is paused
 */
export const AutoRefreshStatus: FC<AutoRefreshStatusProps> = ({
  className,
}) => {
  const {
    isRealTimeDashboard,
    effectiveStatus,
    lastSuccessfulRefresh,
    lastError,
    refreshFrequency,
    autoRefreshFetchStartTime,
  } = useRealTimeDashboard();

  // Don't render if not a real-time dashboard
  if (!isRealTimeDashboard) {
    return null;
  }

  return (
    <Tooltip
      id="auto-refresh-status-tooltip"
      placement="bottom"
      title={
        <StatusTooltipContent
          status={effectiveStatus}
          lastSuccessfulRefresh={lastSuccessfulRefresh}
          lastError={lastError}
          refreshFrequency={refreshFrequency}
          autoRefreshFetchStartTime={autoRefreshFetchStartTime}
        />
      }
    >
      <div className={className} data-test="auto-refresh-status">
        <StatusIndicatorDot status={effectiveStatus} />
      </div>
    </Tooltip>
  );
};

export default AutoRefreshStatus;
