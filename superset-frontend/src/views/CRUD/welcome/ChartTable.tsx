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
import { t } from '@superset-ui/core';
import {
  useListViewResource,
  useChartEditModal,
  useFavoriteStatus,
} from 'src/views/CRUD/hooks';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import { useHistory } from 'react-router-dom';
import PropertiesModal from 'src/explore/components/PropertiesModal';
import { User } from 'src/types/bootstrapTypes';
import Icon from 'src/components/Icon';
import ChartCard from 'src/views/CRUD/chart/ChartCard';
import Chart from 'src/types/Chart';
import SubMenu from 'src/components/Menu/SubMenu';
import EmptyState from './EmptyState';
import { CardContainer, IconContainer } from '../utils';

const PAGE_SIZE = 3;

interface ChartTableProps {
  addDangerToast: (message: string) => void;
  addSuccessToast: (message: string) => void;
  search: string;
  chartFilter?: string;
  user?: User;
  mine: Array<any>;
}

function ChartTable({
  user,
  addDangerToast,
  addSuccessToast,
  mine,
}: ChartTableProps) {
  const history = useHistory();
  const {
    state: { resourceCollection: charts, bulkSelectEnabled },
    setResourceCollection: setCharts,
    hasPerm,
    refreshData,
    fetchData,
  } = useListViewResource<Chart>(
    'chart',
    t('chart'),
    addDangerToast,
    true,
    mine,
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

  const [chartFilter, setChartFilter] = useState('Mine');

  const getFilters = (filterName: string) => {
    const filters = [];

    if (filterName === 'Mine') {
      filters.push({
        id: 'created_by',
        operator: 'rel_o_m',
        value: `${user?.userId}`,
      });
    } else {
      filters.push({
        id: 'id',
        operator: 'chart_is_favorite',
        value: true,
      });
    }
    return filters;
  };

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
        // eslint-disable-next-line react/no-children-prop
        tabs={[
          {
            name: 'Favorite',
            label: t('Favorite'),
            onClick: () =>
              getData('Favorite').then(() => setChartFilter('Favorite')),
          },
          {
            name: 'Mine',
            label: t('Mine'),
            onClick: () => getData('Mine').then(() => setChartFilter('Mine')),
          },
        ]}
        buttons={[
          {
            name: (
              <IconContainer>
                <Icon name="plus-small" />
                {t('Chart')}
              </IconContainer>
            ),
            buttonStyle: 'tertiary',
            onClick: () => {
              history.push('/chart/add');
            },
          },
          {
            name: 'View All »',
            buttonStyle: 'link',
            onClick: () => {
              const target =
                chartFilter === 'Favorite'
                  ? '/chart/list/?filters=(favorite:!t)'
                  : '/chart/list/';
              history.push(target);
            },
          },
        ]}
      />
      {charts?.length ? (
        <CardContainer>
          {charts.map(e => (
            <ChartCard
              key={`${e.id}`}
              openChartEditModal={openChartEditModal}
              chartFilter={chartFilter}
              chart={e}
              userId={user?.userId}
              hasPerm={hasPerm}
              bulkSelectEnabled={bulkSelectEnabled}
              refreshData={refreshData}
              addDangerToast={addDangerToast}
              addSuccessToast={addSuccessToast}
              favoriteStatus={favoriteStatus[e.id]}
              saveFavoriteStatus={saveFavoriteStatus}
            />
          ))}
        </CardContainer>
      ) : (
        <EmptyState tableName="CHARTS" tab={chartFilter} />
      )}
    </>
  );
}

export default withToasts(ChartTable);
