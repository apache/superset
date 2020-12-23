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
import React, { useState, useMemo } from 'react';
import { SupersetClient, t } from '@superset-ui/core';
import { useListViewResource, useFavoriteStatus } from 'src/views/CRUD/hooks';
import { Dashboard, DashboardTableProps } from 'src/views/CRUD/types';
import { useHistory } from 'react-router-dom';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import PropertiesModal from 'src/dashboard/components/PropertiesModal';
import DashboardCard from 'src/views/CRUD/dashboard/DashboardCard';
import SubMenu from 'src/components/Menu/SubMenu';
import Icon from 'src/components/Icon';
import EmptyState from './EmptyState';
import { createErrorHandler, CardContainer, IconContainer } from '../utils';

const PAGE_SIZE = 3;

export interface FilterValue {
  col: string;
  operator: string;
  value: string | boolean | number | null | undefined;
}

function DashboardTable({
  user,
  addDangerToast,
  addSuccessToast,
  mine,
}: DashboardTableProps) {
  const history = useHistory();
  const {
    state: { loading, resourceCollection: dashboards },
    setResourceCollection: setDashboards,
    hasPerm,
    refreshData,
    fetchData,
  } = useListViewResource<Dashboard>(
    'dashboard',
    t('dashboard'),
    addDangerToast,
    true,
    mine,
  );
  const dashboardIds = useMemo(() => dashboards.map(c => c.id), [dashboards]);
  const [saveFavoriteStatus, favoriteStatus] = useFavoriteStatus(
    'dashboard',
    dashboardIds,
    addDangerToast,
  );
  const [editModal, setEditModal] = useState<Dashboard>();
  const [dashboardFilter, setDashboardFilter] = useState('Mine');

  const handleDashboardEdit = (edits: Dashboard) => {
    return SupersetClient.get({
      endpoint: `/api/v1/dashboard/${edits.id}`,
    }).then(
      ({ json = {} }) => {
        setDashboards(
          dashboards.map(dashboard => {
            if (dashboard.id === json.id) {
              return json.result;
            }
            return dashboard;
          }),
        );
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('An error occurred while fetching dashboards: %s', errMsg),
        ),
      ),
    );
  };

  const getFilters = (filterName: string) => {
    const filters = [];
    if (filterName === 'Mine') {
      filters.push({
        id: 'owners',
        operator: 'rel_m_m',
        value: `${user?.userId}`,
      });
    } else {
      filters.push({
        id: 'id',
        operator: 'dashboard_is_favorite',
        value: true,
      });
    }
    return filters;
  };
  const subMenus = [];
  if (dashboards.length > 0 && dashboardFilter === 'favorite') {
    subMenus.push({
      name: 'Favorite',
      label: t('Favorite'),
      onClick: () => setDashboardFilter('Favorite'),
    });
  }

  const getData = (filter: string) => {
    return fetchData({
      pageIndex: 0,
      pageSize: PAGE_SIZE,
      sortBy: [
        {
          id: 'changed_on_delta_humanized',
          desc: true,
        },
      ],
      filters: getFilters(filter),
    });
  };

  return (
    <>
      <SubMenu
        activeChild={dashboardFilter}
        tabs={[
          {
            name: 'Favorite',
            label: t('Favorite'),
            onClick: () => {
              getData('Favorite').then(() => setDashboardFilter('Favorite'));
            },
          },
          {
            name: 'Mine',
            label: t('Mine'),
            onClick: () => {
              getData('Mine').then(() => setDashboardFilter('Mine'));
            },
          },
        ]}
        buttons={[
          {
            name: (
              <IconContainer>
                <Icon name="plus-small" /> Dashboard{' '}
              </IconContainer>
            ),
            buttonStyle: 'tertiary',
            onClick: () => {
              history.push('/dashboard/new');
            },
          },
          {
            name: 'View All »',
            buttonStyle: 'link',
            onClick: () => {
              const target =
                dashboardFilter === 'Favorite'
                  ? '/dashboard/list/?filters=(favorite:!t)'
                  : '/dashboard/list/';
              history.push(target);
            },
          },
        ]}
      />
      {editModal && (
        <PropertiesModal
          dashboardId={editModal?.id}
          show
          onHide={() => setEditModal(undefined)}
          onSubmit={handleDashboardEdit}
        />
      )}
      {dashboards.length > 0 && (
        <CardContainer>
          {dashboards.map(e => (
            <DashboardCard
              key={e.id}
              dashboard={e}
              hasPerm={hasPerm}
              bulkSelectEnabled={false}
              dashboardFilter={dashboardFilter}
              refreshData={refreshData}
              addDangerToast={addDangerToast}
              addSuccessToast={addSuccessToast}
              userId={user?.userId}
              loading={loading}
              openDashboardEditModal={(dashboard: Dashboard) =>
                setEditModal(dashboard)
              }
              saveFavoriteStatus={saveFavoriteStatus}
              favoriteStatus={favoriteStatus[e.id]}
            />
          ))}
        </CardContainer>
      )}
      {dashboards.length === 0 && (
        <EmptyState tableName="DASHBOARDS" tab={dashboardFilter} />
      )}
    </>
  );
}

export default withToasts(DashboardTable);
