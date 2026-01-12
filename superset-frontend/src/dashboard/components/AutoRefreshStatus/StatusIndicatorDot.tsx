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
import { FC, useMemo, useRef, useEffect, useState } from 'react';
import { css, useTheme } from '@apache-superset/core/ui';
import { Icons } from '@superset-ui/core/components/Icons';
import { AutoRefreshStatus } from '../../types/autoRefresh';

export interface StatusIndicatorDotProps {
  /** Current status to display */
  status: AutoRefreshStatus;
  /** Size of the dot in pixels */
  size?: number;
}

/**
 * Status indicator configuration mapping.
 *
 * Per requirements:
 * - Green dot (with checkmark): Refreshed on schedule
 * - Blue dot: Fetching data
 * - Yellow/warning dot: Delayed
 * - Red dot: Error
 * - WHITE dot: Paused (NOT gray)
 */
interface StatusConfig {
  color: string;
  showCheckmark: boolean;
  needsBorder: boolean;
}

const getStatusConfig = (
  theme: ReturnType<typeof useTheme>,
  status: AutoRefreshStatus,
): StatusConfig => {
  switch (status) {
    case AutoRefreshStatus.Success:
    case AutoRefreshStatus.Idle:
      return {
        color: theme.colorSuccess,
        showCheckmark: true,
        needsBorder: false,
      };
    case AutoRefreshStatus.Fetching:
      return {
        color: theme.colorPrimary,
        showCheckmark: false,
        needsBorder: false,
      };
    case AutoRefreshStatus.Delayed:
      return {
        color: theme.colorWarning,
        showCheckmark: false,
        needsBorder: false,
      };
    case AutoRefreshStatus.Error:
      return {
        color: theme.colorError,
        showCheckmark: false,
        needsBorder: false,
      };
    case AutoRefreshStatus.Paused:
      return {
        color: '#FFFFFF',
        showCheckmark: false,
        needsBorder: true,
      };
    default:
      return {
        color: theme.colorTextSecondary,
        showCheckmark: false,
        needsBorder: false,
      };
  }
};

/**
 * A colored dot indicator that shows the auto-refresh status.
 *
 * Uses CSS transitions to prevent flickering between states.
 * The color change is animated smoothly rather than instantly.
 */
export const StatusIndicatorDot: FC<StatusIndicatorDotProps> = ({
  status,
  size = 10,
}) => {
  const theme = useTheme();

  // Debounce rapid status changes to prevent flickering
  const [displayStatus, setDisplayStatus] = useState(status);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any pending timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // For fetching state, update immediately to show user something is happening
    if (status === AutoRefreshStatus.Fetching) {
      setDisplayStatus(status);
    } else {
      // For other states, debounce to prevent flickering
      timerRef.current = setTimeout(() => {
        setDisplayStatus(status);
      }, 100);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [status]);

  const statusConfig = useMemo(
    () => getStatusConfig(theme, displayStatus),
    [theme, displayStatus],
  );

  const dotStyles = useMemo(
    () => css`
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background-color: ${statusConfig.color};
      transition:
        background-color ${theme.motionDurationMid} ease-in-out,
        border-color ${theme.motionDurationMid} ease-in-out;
      border: ${statusConfig.needsBorder
        ? `1px solid ${theme.colorBorder}`
        : 'none'};
      box-shadow: ${statusConfig.needsBorder
        ? 'none'
        : `0 0 0 2px ${theme.colorBgContainer}`};
      margin-left: ${theme.marginXS}px;
      margin-right: ${theme.marginXS}px;
      cursor: help;

      ${displayStatus === AutoRefreshStatus.Fetching &&
      css`
        animation: pulse 1.5s ease-in-out infinite;

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}
    `,
    [statusConfig, size, theme, displayStatus],
  );

  const checkmarkStyles = css`
    font-size: ${size * 0.6}px;
    color: #ffffff;
    line-height: 1;
  `;

  return (
    <span
      css={dotStyles}
      role="status"
      aria-label={`Auto-refresh status: ${displayStatus}`}
      data-test="status-indicator-dot"
      data-status={displayStatus}
    >
      {statusConfig.showCheckmark && (
        <Icons.CheckOutlined css={checkmarkStyles} />
      )}
    </span>
  );
};

export default StatusIndicatorDot;
