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
import React, { useEffect, useMemo, useState } from 'react';
import { t } from '@superset-ui/core';
import { filter } from 'lodash';
import {
  useChartEditModal,
  useFavoriteStatus,
  useListViewResource,
} from 'src/views/CRUD/hooks';
import {
  getItem,
  setItem,
  LocalStorageKeys,
} from 'src/utils/localStorageHelpers';
import withToasts from 'src/components/MessageToasts/withToasts';
import { useHistory } from 'react-router-dom';
import { TableTabTypes } from 'src/views/CRUD/types';
import PropertiesModal from 'src/explore/components/PropertiesModal';
import { User } from 'src/types/bootstrapTypes';
import { CardContainer, PAGE_SIZE } from 'src/views/CRUD/utils';
import { LoadingCards } from 'src/views/CRUD/welcome/Welcome';
import ChartCard from 'src/views/CRUD/chart/ChartCard';
import Chart from 'src/types/Chart';
import handleResourceExport from 'src/utils/export';
import Loading from 'src/components/Loading';
import ErrorBoundary from 'src/components/ErrorBoundary';
import SubMenu from 'src/views/components/SubMenu';
import EmptyState from './EmptyState';
import { WelcomeTable } from './types';

interface ChartTableProps {
  addDangerToast: (message: string) => void;
  addSuccessToast: (message: string) => void;
  search: string;
  chartFilter?: string;
  user?: User;
  mine: Array<any>;
  showThumbnails: boolean;
  examples?: Array<object>;
}

function ChartTable({
  user,
  addDangerToast,
  addSuccessToast,
  mine,
  showThumbnails,
  examples,
}: ChartTableProps) {
  const history = useHistory();
  const filterStore = getItem(
    LocalStorageKeys.homepage_chart_filter,
    TableTabTypes.EXAMPLES,
  );
  const initialFilter = filterStore;

  const filteredExamples = filter(examples, obj => 'viz_type' in obj);

  const {
    state: { loading, resourceCollection: charts, bulkSelectEnabled },
    setResourceCollection: setCharts,
    hasPerm,
    refreshData,
    fetchData,
  } = useListViewResource<Chart>(
    'chart',
    t('chart'),
    addDangerToast,
    true,
    initialFilter === 'Mine' ? mine : filteredExamples,
    [],
    false,
  );

  const chartIds = useMemo(() => charts.map(c => c.id), [charts]);
  const [saveFavoriteStatus, favoriteStatus] = useFavoriteStatus(
    'chart',
    chartIds,
    addDangerToast,
  );
  const {
    sliceCurrentlyEditing,
    openChartEditModal,
    handleChartUpdated,
    closeChartEditModal,
  } = useChartEditModal(setCharts, charts);

  const [chartFilter, setChartFilter] = useState(initialFilter);
  const [preparingExport, setPreparingExport] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (loaded || chartFilter === 'Favorite') {
      getData(chartFilter);
    }
    setLoaded(true);
  }, [chartFilter]);

  const handleBulkChartExport = (chartsToExport: Chart[]) => {
    const ids = chartsToExport.map(({ id }) => id);
    handleResourceExport('chart', ids, () => {
      setPreparingExport(false);
    });
    setPreparingExport(true);
  };

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
        operator: 'chart_is_favorite',
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

  const menuTabs = [
    {
      name: 'Favorite',
      label: t('Favorite'),
      onClick: () => {
        setChartFilter(TableTabTypes.FAVORITE);
        setItem(LocalStorageKeys.homepage_chart_filter, TableTabTypes.FAVORITE);
      },
    },
    {
      name: 'Mine',
      label: t('Mine'),
      onClick: () => {
        setChartFilter(TableTabTypes.MINE);
        setItem(LocalStorageKeys.homepage_chart_filter, TableTabTypes.MINE);
      },
    },
  ];
  if (examples) {
    menuTabs.push({
      name: 'Examples',
      label: t('Examples'),
      onClick: () => {
        setChartFilter(TableTabTypes.EXAMPLES);
        setItem(LocalStorageKeys.homepage_chart_filter, TableTabTypes.EXAMPLES);
      },
    });
  }

  if (loading) return <LoadingCards cover={showThumbnails} />;
  return (
    <ErrorBoundary>
      {sliceCurrentlyEditing && (
        <PropertiesModal
          onHide={closeChartEditModal}
          onSave={handleChartUpdated}
          show
          slice={sliceCurrentlyEditing}
        />
      )}

      <SubMenu
        activeChild={chartFilter}
        tabs={menuTabs}
        buttons={[
          {
            name: (
              <>
                <i className="fa fa-plus" />
                {t('Chart')}
              </>
            ),
            buttonStyle: 'tertiary',
            onClick: () => {
              window.location.assign('/chart/add');
            },
          },
          {
            name: t('View All »'),
            buttonStyle: 'link',
            onClick: () => {
              const target =
                chartFilter === 'Favorite'
                  ? `/chart/list/?filters=(favorite:(label:${t(
                      'Yes',
                    )},value:!t))`
                  : '/chart/list/';
              history.push(target);
            },
          },
        ]}
      />
      {charts?.length ? (
        <CardContainer showThumbnails={showThumbnails}>
          {charts.map(e => (
            <ChartCard
              key={`${e.id}`}
              openChartEditModal={openChartEditModal}
              chartFilter={chartFilter}
              chart={e}
              userId={user?.userId}
              hasPerm={hasPerm}
              showThumbnails={showThumbnails}
              bulkSelectEnabled={bulkSelectEnabled}
              refreshData={refreshData}
              addDangerToast={addDangerToast}
              addSuccessToast={addSuccessToast}
              favoriteStatus={favoriteStatus[e.id]}
              saveFavoriteStatus={saveFavoriteStatus}
              handleBulkChartExport={handleBulkChartExport}
            />
          ))}
        </CardContainer>
      ) : (
        <EmptyState tableName={WelcomeTable.Charts} tab={chartFilter} />
      )}
      {preparingExport && <Loading />}
    </ErrorBoundary>
  );
}

export default withToasts(ChartTable);
