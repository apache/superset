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
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StringParam, useQueryParam } from 'use-query-params';
import { debounce } from 'lodash-es';
import { Loading } from '@superset-ui/core/components';
import { ListViewFilterOperator } from 'src/components';
import { useListViewResource, useFavoriteStatus } from 'src/views/CRUD/hooks';
import { useIsMobile } from 'src/hooks/useIsMobile';
import withToasts from 'src/components/MessageToasts/withToasts';
import type { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import SubMenu from 'src/features/home/SubMenu';
import { DashboardWorkspacePane } from './DashboardWorkspacePane';
import DashboardWorkspaceSidebar from './DashboardWorkspaceSidebar';
import {
  DASHBOARD_WORKSPACE_LIST_COLUMNS,
  DASHBOARD_WORKSPACE_PAGE_SIZE,
  getDashboardWorkspaceDefaultSlug,
} from './constants';
import {
  dashboardIdOrSlug,
  dashboardMatchesIdOrSlug,
  type WorkspaceDashboard,
} from './utils';
import { useDashboardWorkspaceSidebarPrefs } from './useDashboardWorkspaceSidebarPrefs';

const Shell = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  min-width: 0;
`;

const Preview = styled.main`
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

interface DashboardWorkspaceProps {
  addDangerToast: (msg: string) => void;
  user?: UserWithPermissionsAndRoles;
}

function resolvePaneId(
  dashboards: WorkspaceDashboard[],
  queryId: string | null | undefined,
): string | undefined {
  const trimmed = queryId?.trim();
  if (trimmed) {
    const match = dashboards.find(d => dashboardMatchesIdOrSlug(d, trimmed));
    if (match) {
      return dashboardIdOrSlug(match);
    }
    // Deep-link to a dashboard not on the current list page (search / first 100).
    return trimmed;
  }
  const defaultSlug = getDashboardWorkspaceDefaultSlug();
  if (defaultSlug) {
    const match = dashboards.find(d =>
      dashboardMatchesIdOrSlug(d, defaultSlug),
    );
    if (match) {
      return dashboardIdOrSlug(match);
    }
  }
  if (dashboards[0]) {
    return dashboardIdOrSlug(dashboards[0]);
  }
  return undefined;
}

type SearchField = 'dashboard_title' | 'slug';

function DashboardWorkspace({ addDangerToast, user }: DashboardWorkspaceProps) {
  const isMobile = useIsMobile();
  const [queryId, setQueryId] = useQueryParam('id', StringParam);
  const [searchText, setSearchText] = useState('');
  const activeSearchTerm = useRef('');
  const slugRetryForTerm = useRef<string | null>(null);

  const {
    state: { loading, resourceCollection: dashboards, resourceCount },
    hasPerm,
    fetchData,
  } = useListViewResource<WorkspaceDashboard>(
    'dashboard',
    t('dashboard'),
    addDangerToast,
    undefined,
    undefined,
    undefined,
    undefined,
    DASHBOARD_WORKSPACE_LIST_COLUMNS,
  );

  const {
    sortedDashboards,
    sidebarWidth,
    sidebarCollapsed,
    setOrderFromDashboards,
    setWidth,
    setCollapsed,
    resetWidth,
  } = useDashboardWorkspaceSidebarPrefs(user, dashboards, !isMobile);

  const fetchDashboards = useCallback(
    (search: string, field: SearchField) => {
      activeSearchTerm.current = search.trim();
      const filters = search.trim()
        ? [
            {
              id: field,
              operator: ListViewFilterOperator.Contains,
              value: search.trim(),
            },
          ]
        : [];
      fetchData({
        pageIndex: 0,
        pageSize: DASHBOARD_WORKSPACE_PAGE_SIZE,
        sortBy: [{ id: 'changed_on_delta_humanized', desc: true }],
        filters,
      });
    },
    [fetchData],
  );

  const debouncedTitleSearch = useMemo(
    () =>
      debounce((value: string) => {
        slugRetryForTerm.current = null;
        fetchDashboards(value, 'dashboard_title');
      }, 300),
    [fetchDashboards],
  );

  useEffect(() => {
    if (!searchText.trim()) {
      slugRetryForTerm.current = null;
      activeSearchTerm.current = '';
      fetchDashboards('', 'dashboard_title');
      return undefined;
    }
    debouncedTitleSearch(searchText);
    return () => {
      debouncedTitleSearch.cancel();
    };
  }, [searchText, fetchDashboards, debouncedTitleSearch]);

  useEffect(() => {
    const term = searchText.trim();
    if (!term || loading) {
      return;
    }
    if (activeSearchTerm.current !== term) {
      return;
    }
    if (dashboards.length > 0) {
      return;
    }
    if (slugRetryForTerm.current === term) {
      return;
    }
    slugRetryForTerm.current = term;
    fetchDashboards(term, 'slug');
  }, [loading, dashboards.length, searchText, fetchDashboards]);

  const dashboardIds = useMemo(() => dashboards.map(d => d.id), [dashboards]);
  const [saveFavoriteStatus, favoriteStatus] = useFavoriteStatus(
    'dashboard',
    dashboardIds,
    addDangerToast,
  );

  const activeIdOrSlug = useMemo(
    () => (isMobile ? undefined : resolvePaneId(sortedDashboards, queryId)),
    [sortedDashboards, queryId, isMobile],
  );

  useEffect(() => {
    if (isMobile || loading) {
      return;
    }
    if (queryId?.trim()) {
      return;
    }
    const defaultId = resolvePaneId(sortedDashboards, undefined);
    if (defaultId) {
      setQueryId(defaultId, 'replaceIn');
    }
  }, [isMobile, loading, sortedDashboards, queryId, setQueryId]);

  const onSelectDashboard = useCallback(
    (dashboard: WorkspaceDashboard) => {
      setQueryId(dashboardIdOrSlug(dashboard), 'push');
    },
    [setQueryId],
  );

  const listTruncated =
    !searchText.trim() &&
    typeof resourceCount === 'number' &&
    resourceCount > dashboards.length;

  return (
    <>
      <SubMenu name={t('Dashboards')} />
      <Shell data-test="dashboard-workspace">
        <DashboardWorkspaceSidebar
          mobile={isMobile}
          loading={loading}
          searchText={searchText}
          onSearchChange={setSearchText}
          listTruncated={listTruncated}
          truncatedCount={dashboards.length}
          dashboards={sortedDashboards}
          sidebarWidth={sidebarWidth}
          sidebarCollapsed={sidebarCollapsed}
          onWidthChange={setWidth}
          onCollapsedChange={setCollapsed}
          onResetWidth={resetWidth}
          onReorder={setOrderFromDashboards}
          hasPerm={hasPerm}
          saveFavoriteStatus={saveFavoriteStatus}
          favoriteStatus={favoriteStatus}
          user={user}
          activeIdOrSlug={activeIdOrSlug}
          onSelectDashboard={onSelectDashboard}
        />
        {!isMobile && (
          <Preview data-test="dashboard-workspace-preview">
            {activeIdOrSlug ? (
              <DashboardWorkspacePane idOrSlug={activeIdOrSlug} />
            ) : (
              <Loading />
            )}
          </Preview>
        )}
      </Shell>
    </>
  );
}

export default withToasts(DashboardWorkspace);
