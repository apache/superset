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
import { useListViewResource } from 'src/views/CRUD/hooks';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import {
  ListViewFilters,
  ListViewFilterOperator,
  ListView,
} from 'src/components';

export type UserRegistration = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  registration_date: string;
  registration_hash: string;
};

export default function UserRegistrations() {
  const { addSuccessToast, addDangerToast } = useToasts();

  const {
    state: {
      loading,
      resourceCount: registrationsCount,
      resourceCollection: registrations,
    },
    refreshData,
    fetchData,
  } = useListViewResource<UserRegistration>(
    'user_registrations',
    t('User Registrations'),
    addDangerToast,
  );

  const initialSort = [{ id: 'registration_date', desc: true }];

  const columns = useMemo(
    () => [
      {
        accessor: 'username',
        id: 'username',
        Header: t('Username'),
        Cell: ({ row: { original } }: any) => original.username,
      },
      {
        accessor: 'first_name',
        id: 'first_name',
        Header: t('First name'),
        Cell: ({ row: { original } }: any) => original.first_name,
      },
      {
        accessor: 'last_name',
        id: 'last_name',
        Header: t('Last name'),
        Cell: ({ row: { original } }: any) => original.last_name,
      },
      {
        accessor: 'email',
        id: 'email',
        Header: t('Email'),
        Cell: ({ row: { original } }: any) => original.email,
      },
      {
        accessor: 'registration_hash',
        id: 'registration_hash',
        Header: t('Registration Hash'),
        Cell: ({ row: { original } }: any) => original.registration_hash,
      },
      {
        accessor: 'registration_date',
        id: 'registration_date',
        Header: t('Registration Date'),
        Cell: ({ row: { original } }: any) =>
          new Date(original.registration_date).toLocaleDateString(),
      },
    ],
    [],
  );

  const filters: ListViewFilters = useMemo(
    () => [
      {
        Header: t('Username'),
        key: 'username',
        id: 'username',
        input: 'search',
        operator: ListViewFilterOperator.Contains,
      },
      {
        Header: t('First name'),
        key: 'first_name',
        id: 'first_name',
        input: 'search',
        operator: ListViewFilterOperator.Contains,
      },
      {
        Header: t('Last name'),
        key: 'last_name',
        id: 'last_name',
        input: 'search',
        operator: ListViewFilterOperator.Contains,
      },
      {
        Header: t('Email'),
        key: 'email',
        id: 'email',
        input: 'search',
        operator: ListViewFilterOperator.Contains,
      },
      {
        Header: t('Registration Hash'),
        key: 'registration_hash',
        id: 'registration_hash',
        input: 'search',
        operator: ListViewFilterOperator.Contains,
      },
      {
        Header: t('Registration Date'),
        key: 'registration_date',
        id: 'registration_date',
        input: 'datetime_range',
        operator: ListViewFilterOperator.Between,
        dateFilterValueType: 'iso',
      },
    ],
    [],
  );

  const emptyState = {
    title: t('No user registrations yet'),
    image: 'filter-results.svg',
  };

  return (
    <ListView<UserRegistration>
      className="user-registrations-list-view"
      columns={columns}
      count={registrationsCount}
      data={registrations}
      fetchData={fetchData}
      refreshData={refreshData}
      addDangerToast={addDangerToast}
      addSuccessToast={addSuccessToast}
      filters={filters}
      initialSort={initialSort}
      loading={loading}
      pageSize={25}
      emptyState={emptyState}
    />
  );
}
