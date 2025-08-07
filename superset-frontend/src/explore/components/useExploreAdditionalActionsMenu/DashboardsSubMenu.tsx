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
import { useMemo } from 'react';
import { css, t, useTheme } from '@superset-ui/core';
import { MenuItem } from '@superset-ui/core/components/Menu';
import { Icons } from '@superset-ui/core/components/Icons';
import { Link } from 'react-router-dom';

export interface DashboardsMenuProps {
  chartId?: number;
  dashboards?: { id: number; dashboard_title: string }[];
  searchTerm?: string;
}

export const useDashboardsMenuItems = ({
  chartId,
  dashboards = [],
  searchTerm = '',
}: DashboardsMenuProps): MenuItem[] => {
  const theme = useTheme();

  const filteredDashboards = useMemo(() => {
    if (!searchTerm) return dashboards;
    return dashboards.filter(dashboard =>
      dashboard.dashboard_title
        .toLowerCase()
        .includes(searchTerm.toLowerCase()),
    );
  }, [dashboards, searchTerm]);

  const urlQueryString = chartId ? `?focused_chart=${chartId}` : '';
  const noResults = dashboards.length === 0;
  const noResultsFound = searchTerm && filteredDashboards.length === 0;

  return useMemo(() => {
    const items: MenuItem[] = [];

    if (noResults) {
      items.push({
        key: 'no-dashboards',
        label: t('None'),
        disabled: true,
      });
    } else if (noResultsFound) {
      items.push({
        key: 'no-results',
        label: t('No results found'),
        disabled: true,
      });
    } else {
      filteredDashboards.forEach(dashboard => {
        items.push({
          key: String(dashboard.id),
          label: (
            <Link
              target="_blank"
              rel="noreferer noopener"
              to={`/superset/dashboard/${dashboard.id}${urlQueryString}`}
              css={css`
                display: flex;
                flex-direction: row;
                align-items: center;
                width: 200px;
                justify-self: center;
              `}
            >
              <div
                css={css`
                  white-space: normal;
                  flex: 1;
                `}
              >
                {dashboard.dashboard_title}
              </div>
              <Icons.Full
                iconSize="l"
                css={{ marginLeft: theme.sizeUnit * 2 }}
              />
            </Link>
          ),
        });
      });
    }

    return items;
  }, [
    filteredDashboards,
    urlQueryString,
    noResults,
    noResultsFound,
    theme.sizeUnit,
  ]);
};
