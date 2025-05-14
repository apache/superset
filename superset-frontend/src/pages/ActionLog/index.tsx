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
import { t } from '@superset-ui/core';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import { useListViewResource } from 'src/views/CRUD/hooks';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import ListView, { Filters, FilterOperator } from 'src/components/ListView';

export type ActionLogObject = {
  user: {
    username: string;
  };
  action: string;
  dttm: string | null;
  dashboard_id?: number;
  slice_id?: number;
  json?: string;
  duration_ms?: number;
  referrer?: string;
};

const PAGE_SIZE = 25;

function ActionLogList() {
  const { addDangerToast, addSuccessToast } = useToasts();
  const initialSort = [{ id: 'dttm', desc: true }];
  const subMenuButtons: SubMenuProps['buttons'] = [];

  const {
    state: {
      loading,
      resourceCount: LogsCount,
      resourceCollection: Logs,
      bulkSelectEnabled,
    },
    fetchData,
    refreshData,
    toggleBulkSelect,
  } = useListViewResource<ActionLogObject>(
    'log',
    t('Logs'),
    addDangerToast,
    false,
  );
  const filters: Filters = useMemo(
    () => [
      {
        Header: t('User'),
        key: 'user.username',
        id: 'user.username',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Action'),
        key: 'action',
        id: 'action',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Dashboard Id'),
        key: 'dashboard_id',
        id: 'dashboard_id',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Slice Id'),
        key: 'slice_id',
        id: 'slice_id',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('JSON'),
        key: 'json',
        id: 'json',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('dttm'),
        key: 'dttm',
        id: 'dttm',
        input: 'datetime_range',
        operator: FilterOperator.Between,
        dateFilterValueType: 'iso',
      },
      {
        Header: t('Duration Ms'),
        key: 'duration_ms',
        id: 'duration_ms',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Referrer'),
        key: 'referrer',
        id: 'referrer',
        input: 'search',
        operator: FilterOperator.Contains,
      },
    ],
    [],
  );

  const columns = useMemo(
    () => [
      {
        accessor: 'user.username',
        Header: t('User'),
        Cell: ({
          row: {
            original: { user },
          },
        }: any) => <span>{user?.username ?? '—'}</span>,
      },
      {
        accessor: 'action',
        Header: t('Action'),
        Cell: ({
          row: {
            original: { action },
          },
        }: any) => <span>{action}</span>,
      },
      {
        accessor: 'dttm',
        Header: t('Dttm'),
        Cell: ({
          row: {
            original: { dttm },
          },
        }: any) => <span>{dttm}</span>,
      },
      {
        accessor: 'dashboard_id',
        Header: t('Dashboard Id'),
        hidden: true,
        Cell: ({
          row: {
            original: { dashboard_id },
          },
        }: any) => <span>{dashboard_id}</span>,
      },
      {
        accessor: 'slice_id',
        Header: t('Slice Id'),
        hidden: true,
        Cell: ({
          row: {
            original: { slice_id },
          },
        }: any) => <span>{slice_id}</span>,
      },
      {
        accessor: 'json',
        Header: t('JSON'),

        Cell: ({
          row: {
            original: { json },
          },
        }: any) => <span>{json}</span>,
      },
      {
        accessor: 'duration_ms',
        Header: t('Duration Ms'),

        Cell: ({
          row: {
            original: { duration_ms },
          },
        }: any) => <span>{duration_ms}</span>,
      },
      {
        accessor: 'referrer',
        Header: t('Referrer'),

        Cell: ({
          row: {
            original: { referrer },
          },
        }: any) => <span>{referrer}</span>,
      },
    ],
    [],
  );

  const emptyState = {
    title: t('No Logs yet'),
    image: 'filter-results.svg',
  };

  return (
    <>
      <SubMenu name={t('Action Logs')} buttons={subMenuButtons} />
      <ListView<ActionLogObject>
        className="action-log-view"
        columns={columns}
        count={LogsCount}
        data={Logs}
        fetchData={fetchData}
        filters={filters}
        initialSort={initialSort}
        loading={loading}
        pageSize={PAGE_SIZE}
        bulkSelectEnabled={bulkSelectEnabled}
        disableBulkSelect={toggleBulkSelect}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        emptyState={emptyState}
        refreshData={refreshData}
      />
    </>
  );
}

export default ActionLogList;
