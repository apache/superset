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
import { SupersetClient } from '@superset-ui/core';
import rison from 'rison';

import { AdminActivityItem } from './types';

export type AdminActionFilter = 'all' | 'view' | 'edit' | 'export';

export interface AdminActivityResponse {
  result: AdminActivityItem[];
  count: number;
  page: number;
  page_size: number;
}

export async function fetchAdminActivity(options: {
  page?: number;
  pageSize?: number;
  days?: number;
  actionType?: AdminActionFilter;
  coalesce?: boolean;
}): Promise<AdminActivityResponse> {
  const {
    page = 0,
    pageSize = 20,
    days = 7,
    actionType = 'all',
    coalesce = true,
  } = options;

  const actionTypes =
    actionType === 'all' ? ['view', 'edit', 'export'] : [actionType];

  const q = rison.encode({
    page,
    page_size: pageSize,
    days,
    action_types: actionTypes,
    coalesce,
  });

  const response = await SupersetClient.get({
    endpoint: `/api/v1/log/admin_activity/?q=${q}`,
  });

  return response.json as AdminActivityResponse;
}
