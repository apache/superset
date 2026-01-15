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
import { FC, useMemo } from 'react';
import { t } from '@superset-ui/core';
import { css, useTheme } from '@apache-superset/core/ui';
import { Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useRealTimeDashboard } from '../../hooks/useRealTimeDashboard';
import { StatusIndicatorDot } from '../AutoRefreshStatus/StatusIndicatorDot';
import { StatusTooltipContent } from '../AutoRefreshStatus/StatusTooltipContent';

export interface AutoRefreshIndicatorProps {
  onTogglePause: () => void;
}

/**
 * Unified auto-refresh indicator component that displays:
 * - Status dot (green/yellow/red/blue)
 * - Pause/Play button
 *
 * All contained within a bordered container.
 * Only renders when the dashboard has an auto-refresh interval configured.
 */
export const AutoRefreshIndicator: FC<AutoRefreshIndicatorProps> = ({
  onTogglePause,
}) => {
  const theme = useTheme();
  const {
    isRealTimeDashboard,
    isPaused,
    effectiveStatus,
    lastSuccessfulRefresh,
    lastError,
    refreshFrequency,
    autoRefreshFetchStartTime,
    isPausedByTab,
  } = useRealTimeDashboard();

  const containerStyles = useMemo(
    () => css`
      display: inline-flex;
      align-items: center;
      gap: ${theme.marginXXS}px;
      border: 1px solid ${theme.colorSplit};
      border-radius: ${theme.borderRadiusLG}px;
      padding: ${theme.paddingXXS}px;
      background: ${theme.colorBgContainer};
      margin-right: ${theme.marginXS}px;
    `,
    [theme],
  );

  const iconButtonStyles = useMemo(
    () => css`
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${theme.fontSize}px;
      height: ${theme.fontSize}px;
      padding: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      color: ${theme.colorTextSecondary};
      transition: color ${theme.motionDurationMid};

      &:hover {
        color: ${theme.colorText};
      }

      &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }
    `,
    [theme],
  );

  const dotWrapperStyles = useMemo(
    () => css`
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${theme.fontSize}px;
      height: ${theme.fontSize}px;

      & > span {
        margin: 0;
        box-shadow: none;
        cursor: pointer;
      }
    `,
    [theme.fontSize],
  );

  const pauseButton = useMemo(() => {
    const tooltipTitle = isPaused
      ? t('Resume auto-refresh')
      : t('Pause auto-refresh');

    return (
      <Tooltip title={tooltipTitle} placement="bottom">
        <button
          type="button"
          css={iconButtonStyles}
          onClick={onTogglePause}
          aria-label={tooltipTitle}
          data-test="auto-refresh-toggle"
        >
          {isPaused ? (
            <Icons.PlayCircleOutlined iconSize="m" />
          ) : (
            <Icons.PauseCircleOutlined iconSize="m" />
          )}
        </button>
      </Tooltip>
    );
  }, [isPaused, onTogglePause, iconButtonStyles]);

  if (!isRealTimeDashboard) {
    return null;
  }

  return (
    <div css={containerStyles} data-test="auto-refresh-indicator">
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
            isPausedByTab={isPausedByTab}
          />
        }
      >
        <div css={dotWrapperStyles} data-test="auto-refresh-status">
          <StatusIndicatorDot status={effectiveStatus} size={10} />
        </div>
      </Tooltip>

      {pauseButton}
    </div>
  );
};

export default AutoRefreshIndicator;
