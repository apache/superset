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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { css, t, useTheme } from '@superset-ui/core';
import { Tooltip } from '@superset-ui/core/components';
import { usePluginContext } from 'src/components';
import { VizTileProps } from './types';

export const VizTile = ({
  isActive,
  isRendered,
  vizMeta,
  onTileClick,
}: VizTileProps) => {
  const { mountedPluginMetadata } = usePluginContext();
  const chartNameRef = useRef<HTMLSpanElement>(null);
  const theme = useTheme();
  const TILE_TRANSITION_TIME = theme.motionDurationSlow;
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const chartName = vizMeta.name
    ? mountedPluginMetadata[vizMeta.name]?.name || `${vizMeta.name}`
    : t('Select chart type');

  const handleTileClick = useCallback(() => {
    onTileClick(vizMeta.name);
    setIsTransitioning(true);
    setTooltipVisible(false);
    setTimeout(() => {
      setIsTransitioning(false);
    }, 300);
  }, [onTileClick, TILE_TRANSITION_TIME, vizMeta.name]);

  // Antd tooltip seems to be bugged - when elements move, the tooltip sometimes
  // stays visible even when user doesn't hover over the element.
  // Here we manually prevent it from displaying after user triggers transition
  useEffect(() => {
    setShowTooltip(
      Boolean(
        !isTransitioning &&
          (!isActive ||
            (chartNameRef.current &&
              chartNameRef.current.scrollWidth >
                chartNameRef.current.clientWidth)),
      ),
    );
  }, [isActive, isTransitioning]);

  const containerProps = useMemo(
    () =>
      !isActive
        ? { role: 'button', tabIndex: 0, onClick: handleTileClick }
        : {},
    [handleTileClick, isActive],
  );

  let tooltipTitle: string | null = null;
  if (showTooltip) {
    tooltipTitle = isRendered
      ? t('Currently rendered: %s', chartName)
      : chartName;
  }
  return (
    <Tooltip
      title={tooltipTitle}
      onOpenChange={(visible: boolean) => setTooltipVisible(visible)}
      open={tooltipVisible && !isTransitioning}
      placement="top"
      mouseEnterDelay={0.4}
    >
      <div
        {...containerProps}
        css={css`
          display: flex;
          align-items: center;
          color: ${theme.colorText};
          font-weight: ${theme.fontWeightStrong};
          border-radius: 6px;
          white-space: nowrap;
          overflow: hidden;
          max-width: fit-content;
          ${!isActive &&
          css`
            flex-shrink: 0;
            width: ${theme.sizeUnit * 6}px;
            background-color: transparent;
            transition: none;
            &:hover svg path {
              fill: ${theme.colorPrimary};
              transition: fill ${theme.motionDurationMid} ease-out;
            }
          `}

          ${isActive &&
          css`
            width: 100%;
            background-color: ${theme.colorBgLayout};
            transition:
              width ${TILE_TRANSITION_TIME} ease-out,
              background-color ${TILE_TRANSITION_TIME} ease-out;
            cursor: default;
            svg path {
              fill: ${theme.colorPrimary};
            }
          `}
        `}
      >
        <span
          css={css`
            padding: 0px ${theme.sizeUnit * 1.25}px;
          `}
        >
          {vizMeta.icon}
        </span>
        <span
          css={css`
            overflow: hidden;
            text-overflow: ellipsis;
            font-size: ${theme.fontSizeSM}px;
            min-width: 0;
            padding-right: ${theme.sizeUnit}px;
            line-height: 1;
          `}
          ref={chartNameRef}
        >
          {chartName}
        </span>
      </div>
    </Tooltip>
  );
};
