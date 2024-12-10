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
import { memo, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { css, SupersetTheme } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { getChartKey } from 'src/explore/exploreUtils';
import { ExplorePageState } from 'src/explore/types';
import { FastVizSwitcherProps } from './types';
import { VizTile } from './VizTile';
import { FEATURED_CHARTS } from './constants';

export const antdIconProps = {
  iconSize: 'l' as const,
  css: (theme: SupersetTheme) => css`
    padding: ${theme.gridUnit}px;
    & > * {
      line-height: 0;
    }
  `,
};

export const FastVizSwitcher = memo(
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
