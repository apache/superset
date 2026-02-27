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
import { css, useTheme, t } from '@apache-superset/core/ui';
import { Label, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useRealTimeDashboard } from '../../hooks/useRealTimeDashboard';
import { useCurrentTime } from '../../hooks/useCurrentTime';
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
    lastAutoRefreshTime,
    refreshErrorCount,
    refreshFrequency,
    isPausedByTab,
  } = useRealTimeDashboard();
  const currentTime = useCurrentTime(isRealTimeDashboard, lastAutoRefreshTime);

  const iconPixelSize = theme.fontSizeSM;

  const labelStyles = useMemo(
    () => css`
      background-color: ${theme.colorBgContainer};
      border-color: ${theme.colorSplit};
      color: ${theme.colorTextSecondary};
      padding: ${theme.sizeUnit}px;
      column-gap: ${theme.marginXS}px;
      align-items: center;
      display: inline-flex;
    `,
    [theme],
  );

  const iconButtonStyles = useMemo(
    () => css`
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${iconPixelSize}px;
      height: ${iconPixelSize}px;
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
    [iconPixelSize, theme],
  );

  const dotWrapperStyles = useMemo(
    () => css`
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${iconPixelSize}px;
      height: ${iconPixelSize}px;

      & > span {
        margin: 0;
        box-shadow: none;
        cursor: pointer;
      }
    `,
    [iconPixelSize],
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
            <Icons.PlayCircleOutlined iconSize="s" />
          ) : (
            <Icons.PauseCircleOutlined iconSize="s" />
          )}
        </button>
      </Tooltip>
    );
  }, [isPaused, onTogglePause, iconButtonStyles]);

  if (!isRealTimeDashboard) {
    return null;
  }

  return (
    <Label type="default" css={labelStyles} data-test="auto-refresh-indicator">
      <Tooltip
        id="auto-refresh-status-tooltip"
        placement="bottom"
        title={
          <StatusTooltipContent
            status={effectiveStatus}
            lastSuccessfulRefresh={lastSuccessfulRefresh}
            lastAutoRefreshTime={lastAutoRefreshTime}
            refreshErrorCount={refreshErrorCount}
            refreshFrequency={refreshFrequency}
            isPausedByTab={isPausedByTab}
            currentTime={currentTime}
          />
        }
      >
        <div css={dotWrapperStyles} data-test="auto-refresh-status">
          <StatusIndicatorDot status={effectiveStatus} size={iconPixelSize} />
        </div>
      </Tooltip>

      {pauseButton}
    </Label>
  );
};

export default AutoRefreshIndicator;
