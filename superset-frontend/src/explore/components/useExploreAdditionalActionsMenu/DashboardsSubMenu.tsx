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
import { useState } from 'react';
import { css, t, useTheme } from '@superset-ui/core';
import { Input } from 'src/components/Input';
import Icons from 'src/components/Icons';
import { Menu } from 'src/components/Menu';
import { Link } from 'react-router-dom';

export interface DashboardsSubMenuProps {
  chartId?: number;
  dashboards?: { id: number; dashboard_title: string }[];
}

const WIDTH = 220;
const HEIGHT = 300;
const SEARCH_THRESHOLD = 10;

const DashboardsSubMenu = ({
  chartId,
  dashboards = [],
  ...menuProps
}: DashboardsSubMenuProps) => {
  const theme = useTheme();
  const [dashboardSearch, setDashboardSearch] = useState<string>();
  const [hoveredItem, setHoveredItem] = useState<number | null>();
  const showSearch = dashboards.length > SEARCH_THRESHOLD;
  const filteredDashboards = dashboards.filter(
    dashboard =>
      !dashboardSearch ||
      dashboard.dashboard_title
        .toLowerCase()
        .includes(dashboardSearch.toLowerCase()),
  );
  const noResults = dashboards.length === 0;
  const noResultsFound = dashboardSearch && filteredDashboards.length === 0;
  const urlQueryString = chartId ? `?focused_chart=${chartId}` : '';
  return (
    <>
      {showSearch && (
        <Input
          allowClear
          placeholder={t('Search')}
          prefix={<Icons.Search iconSize="l" />}
          css={css`
            width: ${WIDTH}px;
            margin: ${theme.gridUnit * 2}px ${theme.gridUnit * 3}px;
          `}
          value={dashboardSearch}
          onChange={e => setDashboardSearch(e.currentTarget.value)}
        />
      )}
      <div
        css={css`
          max-height: ${HEIGHT}px;
          overflow: auto;
        `}
      >
        {filteredDashboards.map(dashboard => (
          <Menu.Item
            key={String(dashboard.id)}
            onMouseEnter={() => setHoveredItem(dashboard.id)}
            onMouseLeave={() => {
              if (hoveredItem === dashboard.id) {
                setHoveredItem(null);
              }
            }}
            {...menuProps}
          >
            <Link
              target="_blank"
              rel="noreferer noopener"
              to={`/superset/dashboard/${dashboard.id}${urlQueryString}`}
            >
              <div
                css={css`
                  display: flex;
                  flex-direction: row;
                  align-items: center;
                  max-width: ${WIDTH}px;
                `}
              >
                <div
                  css={css`
                    white-space: normal;
                  `}
                >
                  {dashboard.dashboard_title}
                </div>
                <Icons.Full
                  iconSize="l"
                  iconColor={theme.colors.grayscale.base}
                  css={css`
                    margin-left: ${theme.gridUnit * 2}px;
                    visibility: ${hoveredItem === dashboard.id
                      ? 'visible'
                      : 'hidden'};
                  `}
                />
              </div>
            </Link>
          </Menu.Item>
        ))}
        {noResultsFound && (
          <div
            css={css`
              margin-left: ${theme.gridUnit * 3}px;
              margin-bottom: ${theme.gridUnit}px;
            `}
          >
            {t('No results found')}
          </div>
        )}
        {noResults && (
          <Menu.Item
            disabled
            css={css`
              min-width: ${WIDTH}px;
            `}
            {...menuProps}
          >
            {t('None')}
          </Menu.Item>
        )}
      </div>
    </>
  );
};

export default DashboardsSubMenu;
