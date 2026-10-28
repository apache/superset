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
import { css, styled } from '@apache-superset/core/theme';
import { ReactNode, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Resizable } from 're-resizable';
import { Button, Icons, Input, Loading, Tooltip } from '@superset-ui/core/components';
import DashboardCard from 'src/features/dashboards/DashboardCard';
import type { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import {
  DASHBOARD_WORKSPACE_SIDEBAR_COLLAPSED_WIDTH,
  DASHBOARD_WORKSPACE_SIDEBAR_MAX_WIDTH,
  DASHBOARD_WORKSPACE_SIDEBAR_MIN_WIDTH,
} from './constants';
import SortableDashboardCard from './SortableDashboardCard';
import { dashboardIdOrSlug, type WorkspaceDashboard } from './utils';

const SidebarOuter = styled.div`
  position: relative;
  flex-shrink: 0;
  height: 100%;
  min-height: 0;
  display: flex;
`;

const ResizableShell = styled.div`
  height: 100%;
  min-height: 0;

  .dashboard-workspace-sidebar-resizer {
    z-index: 101;
  }

  .dashboard-workspace-sidebar-resizer::after {
    display: block;
    content: '';
    width: 1px;
    height: 100%;
    margin: 0 auto;
  }

  &:hover .dashboard-workspace-sidebar-resizer::after {
    background-color: ${({ theme }) => theme.colorPrimary};
  }
`;

const SidebarInner = styled.aside<{ $mobile?: boolean }>`
  height: 100%;
  min-height: 0;
  border-right: ${({ theme, $mobile }) =>
    $mobile ? 'none' : `1px solid ${theme.colorBorderSecondary}`};
  overflow-y: auto;
  padding: ${({ theme, $mobile }) =>
    $mobile ? `${theme.sizeUnit * 3}px` : `${theme.sizeUnit * 2}px`};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  box-sizing: border-box;
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.sizeUnit}px;
  flex-shrink: 0;
`;

const CollapsedRail = styled.div`
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: ${({ theme }) => theme.sizeUnit * 2}px;
  border-right: 1px solid ${({ theme }) => theme.colorBorderSecondary};
  box-sizing: border-box;
`;

const CardGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

type Props = {
  mobile: boolean;
  loading: boolean;
  searchText: string;
  onSearchChange: (value: string) => void;
  listTruncated: boolean;
  truncatedCount: number;
  dashboards: WorkspaceDashboard[];
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  onWidthChange: (width: number) => void;
  onCollapsedChange: (collapsed: boolean) => void;
  onResetWidth: () => void;
  onReorder: (dashboards: WorkspaceDashboard[]) => void;
  hasPerm: (name: string) => boolean;
  saveFavoriteStatus: (id: number, isStarred: boolean) => void;
  favoriteStatus: Record<number, boolean>;
  user?: UserWithPermissionsAndRoles;
  activeIdOrSlug?: string;
  onSelectDashboard: (dashboard: WorkspaceDashboard) => void;
};

export default function DashboardWorkspaceSidebar({
  mobile,
  loading,
  searchText,
  onSearchChange,
  listTruncated,
  truncatedCount,
  dashboards,
  sidebarWidth,
  sidebarCollapsed,
  onWidthChange,
  onCollapsedChange,
  onResetWidth,
  onReorder,
  hasPerm,
  saveFavoriteStatus,
  favoriteStatus,
  user,
  activeIdOrSlug,
  onSelectDashboard,
}: Props) {
  const sortableIds = useMemo(
    () => dashboards.map(d => dashboardIdOrSlug(d)),
    [dashboards],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }
      const oldIndex = sortableIds.indexOf(String(active.id));
      const newIndex = sortableIds.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) {
        return;
      }
      onReorder(arrayMove(dashboards, oldIndex, newIndex));
    },
    [dashboards, onReorder, sortableIds],
  );

  const listBody = (): ReactNode => {
    if (loading) {
      return <Loading />;
    }
    if (dashboards.length === 0) {
      return <div>{t('No dashboards found')}</div>;
    }
    const cards = dashboards.map(dashboard => {
      const idOrSlug = dashboardIdOrSlug(dashboard);
      const card = (
        <DashboardCard
          dashboard={dashboard}
          hasPerm={hasPerm}
          bulkSelectEnabled={false}
          loading={false}
          saveFavoriteStatus={saveFavoriteStatus}
          favoriteStatus={favoriteStatus[dashboard.id]}
          user={user}
          showThumbnails
          onSelect={mobile ? undefined : onSelectDashboard}
          isActive={!mobile && activeIdOrSlug === idOrSlug}
          workspaceMode
        />
      );
      if (mobile) {
        return <div key={dashboard.id}>{card}</div>;
      }
      return (
        <SortableDashboardCard key={dashboard.id} id={idOrSlug}>
          {card}
        </SortableDashboardCard>
      );
    });

    if (mobile) {
      return <CardGrid>{cards}</CardGrid>;
    }

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortableIds}
          strategy={verticalListSortingStrategy}
        >
          <CardGrid data-test="dashboard-workspace-card-list">{cards}</CardGrid>
        </SortableContext>
      </DndContext>
    );
  };

  if (mobile) {
    return (
      <SidebarInner
        data-test="dashboard-workspace-sidebar"
        $mobile
        css={css({ width: '100%' })}
      >
        <Input
          allowClear
          placeholder={t('Search by title or slug')}
          value={searchText}
          onChange={e => onSearchChange(e.target.value)}
          data-test="dashboard-workspace-search"
        />
        {listTruncated && (
          <div data-test="dashboard-workspace-truncation-hint">
            {t(
              'Showing the first %(count)s dashboards. Search by title or slug to find others.',
              { count: truncatedCount },
            )}
          </div>
        )}
        {listBody()}
      </SidebarInner>
    );
  }

  const displayWidth = sidebarCollapsed
    ? DASHBOARD_WORKSPACE_SIDEBAR_COLLAPSED_WIDTH
    : sidebarWidth;

  return (
    <SidebarOuter data-test="dashboard-workspace-sidebar">
      <ResizableShell>
        <Resizable
          size={{ width: displayWidth, height: '100%' }}
          minWidth={
            sidebarCollapsed
              ? DASHBOARD_WORKSPACE_SIDEBAR_COLLAPSED_WIDTH
              : DASHBOARD_WORKSPACE_SIDEBAR_MIN_WIDTH
          }
          maxWidth={
            sidebarCollapsed
              ? DASHBOARD_WORKSPACE_SIDEBAR_COLLAPSED_WIDTH
              : DASHBOARD_WORKSPACE_SIDEBAR_MAX_WIDTH
          }
          enable={{ right: !sidebarCollapsed }}
          handleClasses={{ right: 'dashboard-workspace-sidebar-resizer' }}
          onResizeStop={(_e, _dir, _ref, delta) => {
            if (!sidebarCollapsed) {
              onWidthChange(sidebarWidth + delta.width);
            }
          }}
        >
          {sidebarCollapsed ? (
            <CollapsedRail
              style={{ width: DASHBOARD_WORKSPACE_SIDEBAR_COLLAPSED_WIDTH }}
            >
              <Tooltip title={t('Expand sidebar')}>
                <Button
                  type="text"
                  aria-label={t('Expand sidebar')}
                  data-test="dashboard-workspace-sidebar-expand"
                  icon={<Icons.MenuUnfoldOutlined iconSize="m" />}
                  onClick={() => onCollapsedChange(false)}
                />
              </Tooltip>
            </CollapsedRail>
          ) : (
            <SidebarInner style={{ width: sidebarWidth }}>
              <Toolbar>
                <Tooltip title={t('Reset sidebar width')}>
                  <Button
                    type="text"
                    aria-label={t('Reset sidebar width')}
                    data-test="dashboard-workspace-sidebar-reset-width"
                    icon={<Icons.ReloadOutlined iconSize="m" />}
                    onClick={onResetWidth}
                  />
                </Tooltip>
                <Tooltip title={t('Collapse sidebar')}>
                  <Button
                    type="text"
                    aria-label={t('Collapse sidebar')}
                    data-test="dashboard-workspace-sidebar-collapse"
                    icon={<Icons.MenuFoldOutlined iconSize="m" />}
                    onClick={() => onCollapsedChange(true)}
                  />
                </Tooltip>
              </Toolbar>
              <Input
                allowClear
                placeholder={t('Search by title or slug')}
                value={searchText}
                onChange={e => onSearchChange(e.target.value)}
                data-test="dashboard-workspace-search"
              />
              {listTruncated && (
                <div data-test="dashboard-workspace-truncation-hint">
                  {t(
                    'Showing the first %(count)s dashboards. Search by title or slug to find others.',
                    { count: truncatedCount },
                  )}
                </div>
              )}
              {listBody()}
            </SidebarInner>
          )}
        </Resizable>
      </ResizableShell>
    </SidebarOuter>
  );
}
