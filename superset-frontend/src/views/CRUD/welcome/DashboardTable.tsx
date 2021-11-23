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
import React, { useState, useMemo, useEffect } from 'react';
import { SupersetClient, t } from '@superset-ui/core';
import { filter } from 'lodash';
import { useListViewResource, useFavoriteStatus } from 'src/views/CRUD/hooks';
import {
  Dashboard,
  DashboardTableProps,
  TableTabTypes,
} from 'src/views/CRUD/types';
import handleResourceExport from 'src/utils/export';
import { useHistory } from 'react-router-dom';
import {
  setInLocalStorage,
  getFromLocalStorage,
} from 'src/utils/localStorageHelpers';
import { LoadingCards } from 'src/views/CRUD/welcome/Welcome';
import {
  createErrorHandler,
  CardContainer,
  PAGE_SIZE,
} from 'src/views/CRUD/utils';
import { HOMEPAGE_DASHBOARD_FILTER } from 'src/views/CRUD/storageKeys';
import withToasts from 'src/components/MessageToasts/withToasts';
import Loading from 'src/components/Loading';
import PropertiesModal from 'src/dashboard/components/PropertiesModal';
import DashboardCard from 'src/views/CRUD/dashboard/DashboardCard';
import SubMenu from 'src/components/Menu/SubMenu';
import EmptyState from './EmptyState';

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
  showThumbnails,
  examples,
}: DashboardTableProps) {
  const history = useHistory();
  const filterStore = getFromLocalStorage(HOMEPAGE_DASHBOARD_FILTER, null);
  const defaultFilter = filterStore || TableTabTypes.EXAMPLES;

  const filteredExamples = filter(examples, obj => !('viz_type' in obj));

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
    defaultFilter === 'Mine' ? mine : filteredExamples,
    [],
    false,
  );
  const dashboardIds = useMemo(() => dashboards.map(c => c.id), [dashboards]);
  const [saveFavoriteStatus, favoriteStatus] = useFavoriteStatus(
    'dashboard',
    dashboardIds,
    addDangerToast,
  );

  const [editModal, setEditModal] = useState<Dashboard>();
  const [dashboardFilter, setDashboardFilter] = useState(defaultFilter);
  const [preparingExport, setPreparingExport] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (loaded || dashboardFilter === 'Favorite') {
      getData(dashboardFilter);
    }
    setLoaded(true);
  }, [dashboardFilter]);

  const handleBulkDashboardExport = (dashboardsToExport: Dashboard[]) => {
    const ids = dashboardsToExport.map(({ id }) => id);
    handleResourceExport('dashboard', ids, () => {
      setPreparingExport(false);
    });
    setPreparingExport(true);
  };

  const handleDashboardEdit = (edits: Dashboard) =>
    SupersetClient.get({
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

  const getFilters = (filterName: string) => {
    const filters = [];
    if (filterName === 'Mine') {
      filters.push({
        id: 'created_by',
        operator: 'rel_o_m',
        value: `${user?.userId}`,
      });
    } else if (filterName === 'Favorite') {
      filters.push({
        id: 'id',
        operator: 'dashboard_is_favorite',
        value: true,
      });
    } else if (filterName === 'Examples') {
      filters.push({
        id: 'created_by',
        operator: 'rel_o_m',
        value: 0,
      });
    }
    return filters;
  };

  const menuTabs = [
    {
      name: 'Favorite',
      label: t('Favorite'),
      onClick: () => {
        setDashboardFilter(TableTabTypes.FAVORITE);
        setInLocalStorage(HOMEPAGE_DASHBOARD_FILTER, TableTabTypes.FAVORITE);
      },
    },
    {
      name: 'Mine',
      label: t('Mine'),
      onClick: () => {
        setDashboardFilter(TableTabTypes.MINE);
        setInLocalStorage(HOMEPAGE_DASHBOARD_FILTER, TableTabTypes.MINE);
      },
    },
  ];

  if (examples) {
    menuTabs.push({
      name: 'Examples',
      label: t('Examples'),
      onClick: () => {
        setDashboardFilter(TableTabTypes.EXAMPLES);
        setInLocalStorage(HOMEPAGE_DASHBOARD_FILTER, TableTabTypes.EXAMPLES);
      },
    });
  }

  const getData = (filter: string) =>
    fetchData({
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

  if (loading) return <LoadingCards cover={showThumbnails} />;
  return (
    <>
      <SubMenu
        activeChild={dashboardFilter}
        tabs={menuTabs}
        buttons={[
          {
            name: (
              <>
                <i className="fa fa-plus" />
                Dashboard
              </>
            ),
            buttonStyle: 'tertiary',
            onClick: () => {
              window.location.assign('/dashboard/new');
            },
          },
          {
            name: 'View All »',
            buttonStyle: 'link',
            onClick: () => {
              const target =
                dashboardFilter === 'Favorite'
                  ? `/dashboard/list/?filters=(favorite:(label:${t(
                      'Yes',
                    )},value:!t))`
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
        <CardContainer showThumbnails={showThumbnails}>
          {dashboards.map(e => (
            <DashboardCard
              key={e.id}
              dashboard={e}
              hasPerm={hasPerm}
              bulkSelectEnabled={false}
              showThumbnails={showThumbnails}
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
              handleBulkDashboardExport={handleBulkDashboardExport}
            />
          ))}
        </CardContainer>
      )}
      {dashboards.length === 0 && (
        <EmptyState tableName="DASHBOARDS" tab={dashboardFilter} />
      )}
      {preparingExport && <Loading />}
    </>
  );
}

export default withToasts(DashboardTable);
