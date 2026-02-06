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

import {
  ActionTypeFilter,
  ActivityFeedResponse,
  ActivitySummary,
} from './types';

export async function fetchDashboardActivity(
  dashboardId: number,
  options: {
    page?: number;
    pageSize?: number;
    actionType?: ActionTypeFilter;
    days?: number;
  } = {},
): Promise<ActivityFeedResponse> {
  const { page = 0, pageSize = 25, actionType = 'all', days = 30 } = options;

  const response = await SupersetClient.get({
    endpoint: `/api/v1/dashboard/${dashboardId}/activity/`,
    searchParams: {
      page,
      page_size: pageSize,
      action_type: actionType,
      days,
    },
  });

  return response.json.result as ActivityFeedResponse;
}

export async function fetchDashboardActivitySummary(
  dashboardId: number,
  days = 30,
): Promise<ActivitySummary> {
  const response = await SupersetClient.get({
    endpoint: `/api/v1/dashboard/${dashboardId}/activity/summary/`,
    searchParams: { days },
  });

  return response.json.result as ActivitySummary;
}
