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
import { css, useTheme } from '@apache-superset/core/ui';
import { Tooltip, Button } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useRealTimeDashboard } from '../../hooks/useRealTimeDashboard';

export interface AutoRefreshControlsProps {
  /** Callback when pause/resume is toggled */
  onTogglePause: () => void;
  /** Callback when manual refresh is triggered */
  onRefresh?: () => void;
  /** Whether the dashboard is loading */
  isLoading?: boolean;
  /** Whether to show the refresh button alongside pause */
  showRefreshButton?: boolean;
}

/**
 * Pause/Resume and Refresh buttons for real-time dashboards.
 * Only renders when auto-refresh is enabled.
 */
export const AutoRefreshControls: FC<AutoRefreshControlsProps> = ({
  onTogglePause,
  onRefresh,
  isLoading,
  showRefreshButton = false,
}) => {
  const theme = useTheme();
  const { isRealTimeDashboard, isPaused } = useRealTimeDashboard();

  // Don't render if not a real-time dashboard
  if (!isRealTimeDashboard) {
    return null;
  }

  const containerStyles = css`
    display: flex;
    align-items: center;
    gap: ${theme.marginXS}px;
  `;

  const buttonStyles = css`
    padding: ${theme.paddingXXS}px ${theme.paddingXS}px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: ${theme.controlHeight}px;
    height: ${theme.controlHeight}px;
  `;

  const pauseTooltipTitle = isPaused
    ? t('Resume auto-refresh')
    : t('Pause auto-refresh');

  const PauseIcon = isPaused
    ? Icons.PlayCircleOutlined
    : Icons.PauseCircleOutlined;

  return (
    <div css={containerStyles}>
      <Tooltip title={pauseTooltipTitle} placement="bottom">
        <Button
          css={buttonStyles}
          buttonStyle="link"
          onClick={onTogglePause}
          disabled={isLoading}
          aria-label={pauseTooltipTitle}
          data-test="auto-refresh-toggle"
        >
          <PauseIcon iconSize="l" />
        </Button>
      </Tooltip>

      {showRefreshButton && onRefresh && (
        <Tooltip title={t('Refresh dashboard')} placement="bottom">
          <Button
            css={buttonStyles}
            buttonStyle="link"
            onClick={onRefresh}
            disabled={isLoading}
            aria-label={t('Refresh dashboard')}
            data-test="auto-refresh-refresh-button"
          >
            <Icons.ReloadOutlined iconSize="l" />
          </Button>
        </Tooltip>
      )}
    </div>
  );
};

export default AutoRefreshControls;
