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
import { SupersetClient, t } from '@superset-ui/core';
import rison from 'rison';
import { FormValues } from './types';

export const createGroup = async (values: FormValues) => {
  await SupersetClient.post({
    endpoint: '/api/v1/security/groups/',
    jsonPayload: { ...values, users: values.users.map(user => user.value) },
  });
};

export const updateGroup = async (groupId: number, values: FormValues) => {
  await SupersetClient.put({
    endpoint: `/api/v1/security/groups/${groupId}`,
    jsonPayload: { ...values, users: values.users.map(user => user.value) },
  });
};

export const deleteGroup = async (groupId: number) =>
  SupersetClient.delete({
    endpoint: `/api/v1/security/groups/${groupId}`,
  });

export const fetchUserOptions = async (
  filterValue: string,
  page: number,
  pageSize: number,
  addDangerToast: (msg: string) => void,
) => {
  const query = rison.encode({
    filter: filterValue,
    page,
    page_size: pageSize,
    order_column: 'username',
    order_direction: 'asc',
  });

  try {
    const response = await SupersetClient.get({
      endpoint: `/api/v1/security/users/?q=${query}`,
    });

    const results = response.json?.result || [];

    return {
      data: results.map((user: any) => ({
        value: user.id,
        label: user.username,
      })),
      totalCount: response.json?.count ?? 0,
    };
  } catch (error) {
    addDangerToast(t('There was an error while fetching users'));
    return { data: [], totalCount: 0 };
  }
};
