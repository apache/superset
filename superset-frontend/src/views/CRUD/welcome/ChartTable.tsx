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
import React, { useEffect } from 'react';
import { t } from '@superset-ui/core';
import { debounce } from 'lodash';
import ListView, { FetchDataConfig } from 'src/components/ListView';
import { useListViewResource, useFavoriteStatus } from 'src/views/CRUD/hooks';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import { User } from 'src/types/bootstrapTypes';
import ListViewCard from 'src/components/ListViewCard';
import { Dropdown, Menu } from 'src/common/components';
import Icon from 'src/components/Icon';
import Label from 'src/components/Label';
import Owner from 'src/types/Owner';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import DashboardCard from '../dashboard/DashboardCard';
const PAGE_SIZE = 3;

interface ChartTableProps {
  addDangerToast: (message: string) => void;
  addSuccessToast: (message: string) => void;
  search: string;
  chartFilter?: string;
  user?: User;
}

interface Dashboard {
  changed_by_name: string;
  changed_by_url: string;
  changed_on_delta_humanized: string;
  changed_by: string;
  dashboard_title: string;
  slice_name: string;
  id: number;
  published: boolean;
  url: string;
  thumbnail_url: string;
  owners: Owner[];
  loading: boolean;
}

interface ChartTableState {
  charts: Dashboard[];
  chart_count: number;
  loading: boolean;
}

export interface FilterValue {
  col: string;
  operator: string;
  value: string | boolean | number | null | undefined;
}

export interface FetchDataConfig {
  filters: FilterValue[];
}

function ChartTable({
  chartFilter,
  user,
  addDangerToast,
  addSuccessToast,
}: ChartTableProps) {
  const {
    state: { loading, resourceCollection: charts, bulkSelectEnabled },
    hasPerm,
    refreshData,
    fetchData,
  } = useListViewResource<Dashboard>('chart', t('chart'), addDangerToast);
  console.log('dashboardFilter', chartFilter);
  const getFilters = () => {
    const filters = [];

    if (chartFilter === 'Mine') {
      filters.push({
        id: 'owners',
        operator: 'rel_m_m',
        value: `${user?.userId}`,
      });
    } else {
      filters.push({
        id: 'id',
        operator: 'chart_is_fav',
        value: true,
       /* id: 'favorite', // API currently can't filter by favorite
        operator: 'eq',
        value: true,
        */
      });
    }
    // Do we need search?
    /* filters.concat([
      {
        id: 'dashboard_title',
        operator: 'ct',
        value: search,
      },
    ]);
    */
    return filters;
  };

  useEffect(() => {
    fetchData({
      pageIndex: 0,
      pageSize: PAGE_SIZE,
      sortBy: [
        {
          id: 'changed_on_delta_humanized',
          desc: true,
        },
      ],
      filters: getFilters(),
    });
  }, [chartFilter]);
  console.log("----charts: ", charts);
  return (
    <>
      {charts.map(e => (
        <DashboardCard
          {...{
            dashboard: e,
            hasPerm,
            bulkSelectEnabled,
            refreshData,
            addDangerToast,
            addSuccessToast,
          }}
          isChart
        />
      ))}
    </>
  );
}

export default withToasts(ChartTable);
