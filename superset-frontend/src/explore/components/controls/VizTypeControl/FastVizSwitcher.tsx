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
import React, {
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSelector } from 'react-redux';
import { css, SupersetTheme, t, useTheme } from '@superset-ui/core';
import { usePluginContext } from 'src/components/DynamicPlugins';
import { Tooltip } from 'src/components/Tooltip';
import Icons from 'src/components/Icons';
import { getChartKey } from 'src/explore/exploreUtils';
import { ExplorePageState } from 'src/explore/types';

export interface VizMeta {
  icon: ReactElement;
  name: string;
}

export interface FastVizSwitcherProps {
  onChange: (vizName: string) => void;
  currentSelection: string | null;
}
interface VizTileProps {
  vizMeta: VizMeta;
  isActive: boolean;
  isRendered: boolean;
  onTileClick: (vizType: string) => void;
}

const FEATURED_CHARTS: VizMeta[] = [
  {
    name: 'echarts_timeseries_line',
    icon: <Icons.LineChartTile />,
  },
  {
    name: 'echarts_timeseries_bar',
    icon: <Icons.BarChartTile />,
  },
  { name: 'echarts_area', icon: <Icons.AreaChartTile /> },
  { name: 'table', icon: <Icons.TableChartTile /> },
  {
    name: 'big_number_total',
    icon: <Icons.BigNumberChartTile />,
  },
  { name: 'pie', icon: <Icons.PieChartTile /> },
];

const antdIconProps = {
  iconSize: 'l' as const,
  css: (theme: SupersetTheme) => css`
    padding: ${theme.gridUnit}px;
    & > * {
      line-height: 0;
    }
  `,
};

const VizTile = ({
  isActive,
  isRendered,
  vizMeta,
  onTileClick,
}: VizTileProps) => {
  const { mountedPluginMetadata } = usePluginContext();
  const chartNameRef = useRef<HTMLSpanElement>(null);
  const theme = useTheme();
  const TILE_TRANSITION_TIME = theme.transitionTiming * 2;
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const chartName = vizMeta.name
    ? mountedPluginMetadata[vizMeta.name]?.name || `${vizMeta.name}`
    : t('Select Viz Type');

  const handleTileClick = useCallback(() => {
    onTileClick(vizMeta.name);
    setIsTransitioning(true);
    setTooltipVisible(false);
    setTimeout(() => {
      setIsTransitioning(false);
    }, TILE_TRANSITION_TIME * 1000);
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
      onVisibleChange={visible => setTooltipVisible(visible)}
      visible={tooltipVisible && !isTransitioning}
      placement="top"
      mouseEnterDelay={0.4}
    >
      <div
        {...containerProps}
        css={css`
          display: flex;
          align-items: center;
          text-transform: uppercase;

          color: ${theme.colors.grayscale.base};
          font-weight: ${theme.typography.weights.bold};
          border-radius: 6px;
          white-space: nowrap;
          overflow: hidden;
          max-width: fit-content;

          ${!isActive &&
          css`
            flex-shrink: 0;
            width: ${theme.gridUnit * 6}px;
            background-color: transparent;
            transition: none;
            &:hover svg path {
              fill: ${theme.colors.primary.base};
              transition: fill ${theme.transitionTiming}s ease-out;
            }
          `}

          ${isActive &&
          css`
            width: 100%;
            background-color: ${theme.colors.grayscale.light4};
            transition: width ${TILE_TRANSITION_TIME}s ease-out,
              background-color ${TILE_TRANSITION_TIME}s ease-out;
            cursor: default;
            svg path {
              fill: ${theme.colors.primary.base};
            }
          `}
        `}
      >
        {vizMeta.icon}{' '}
        <span
          css={css`
            overflow: hidden;
            text-overflow: ellipsis;
            min-width: 0;
            padding-right: ${theme.gridUnit}px;
          `}
          ref={chartNameRef}
        >
          {chartName}
        </span>
      </div>
    </Tooltip>
  );
};

export const FastVizSwitcher = React.memo(
  ({ currentSelection, onChange }: FastVizSwitcherProps) => {
    const currentViz = useSelector<ExplorePageState, string | undefined>(
      state =>
        state.charts?.[getChartKey(state.explore)]?.latestQueryFormData
          ?.viz_type,
    );
    const vizTiles = useMemo(() => {
      const vizTiles = [...FEATURED_CHARTS];
      if (
        currentSelection &&
        FEATURED_CHARTS.every(
          featuredVizMeta => featuredVizMeta.name !== currentSelection,
        ) &&
        currentSelection !== currentViz
      ) {
        vizTiles.unshift({
          name: currentSelection,
          icon: (
            <Icons.MonitorOutlined {...antdIconProps} aria-label="monitor" />
          ),
        });
      }
      if (
        currentViz &&
        FEATURED_CHARTS.every(
          featuredVizMeta => featuredVizMeta.name !== currentViz,
        )
      ) {
        vizTiles.unshift({
          name: currentViz,
          icon: (
            <Icons.CheckSquareOutlined
              {...antdIconProps}
              aria-label="check-square"
            />
          ),
        });
      }
      return vizTiles;
    }, [currentSelection, currentViz]);

    return (
      <div
        css={(theme: SupersetTheme) => css`
          display: flex;
          justify-content: space-between;
          column-gap: ${theme.gridUnit}px;
        `}
        data-test="fast-viz-switcher"
      >
        {vizTiles.map(vizMeta => (
          <VizTile
            vizMeta={vizMeta}
            isActive={currentSelection === vizMeta.name}
            isRendered={currentViz === vizMeta.name}
            onTileClick={onChange}
            key={vizMeta.name}
          />
        ))}
      </div>
    );
  },
);
