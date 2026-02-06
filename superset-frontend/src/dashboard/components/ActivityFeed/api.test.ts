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
import fetchMock from 'fetch-mock';

import {
  fetchDashboardActivity,
  fetchDashboardActivitySummary,
} from './api';

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('fetchDashboardActivity passes filters and returns result payload', async () => {
  fetchMock.get('glob:*/api/v1/dashboard/12/activity/*', {
    result: {
      activities: [],
      count: 0,
      page: 0,
      page_size: 25,
    },
  });

  const result = await fetchDashboardActivity(12, {
    actionType: 'view',
    days: 7,
    page: 2,
    pageSize: 10,
  });

  expect(result.count).toBe(0);

  const call = fetchMock.callHistory.lastCall();
  expect(call?.url).toContain('/api/v1/dashboard/12/activity/');
  expect(call?.url).toContain('action_type=view');
  expect(call?.url).toContain('days=7');
  expect(call?.url).toContain('page=2');
  expect(call?.url).toContain('page_size=10');
});

test('fetchDashboardActivitySummary calls summary endpoint', async () => {
  fetchMock.get('glob:*/api/v1/dashboard/45/activity/summary/*', {
    result: {
      total_views: 2,
      unique_viewers: 1,
      views_today: 1,
      recent_editors: ['admin'],
      period_days: 30,
    },
  });

  const result = await fetchDashboardActivitySummary(45, 30);

  expect(result.views_today).toBe(1);
  const call = fetchMock.callHistory.lastCall();
  expect(call?.url).toContain('/api/v1/dashboard/45/activity/summary/');
});
