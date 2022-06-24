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

import sinon from 'sinon';
import fetchMock from 'fetch-mock';
import {
  fetchDashboards,
  FETCH_DASHBOARDS_FAILED,
  FETCH_DASHBOARDS_SUCCEEDED,
} from './saveModalActions';

const userId = 1;
const fetchDashboardsEndpoint = `glob:*/dashboardasync/api/read?_flt_0_owners=${1}`;
const mockDashboardData = {
  pks: ['id'],
  result: [{ id: 'id', dashboard_title: 'dashboard title' }],
};

test('fetchDashboards makes the correct fetch request', () => {
  fetchMock.restore();
  fetchMock.get(fetchDashboardsEndpoint, mockDashboardData);
  const dispatch = sinon.spy();
  return fetchDashboards(userId)(dispatch).then(() => {
    expect(fetchMock.calls(fetchDashboardsEndpoint)).toHaveLength(1);

    return Promise.resolve();
  });
});

test('fetchDashboards calls correct actions on success', () => {
  fetchMock.restore();
  fetchMock.get(fetchDashboardsEndpoint, mockDashboardData);
  const dispatch = sinon.spy();
  return fetchDashboards(userId)(dispatch).then(() => {
    expect(dispatch.callCount).toBe(1);
    expect(dispatch.getCall(0).args[0].type).toBe(FETCH_DASHBOARDS_SUCCEEDED);

    return Promise.resolve();
  });
});

test('fetchDashboards calls correct actions on error', () => {
  fetchMock.restore();
  fetchMock.get(
    fetchDashboardsEndpoint,
    { throws: 'error' },
    { overwriteRoutes: true },
  );

  const dispatch = sinon.spy();
  return fetchDashboards(userId)(dispatch).then(() => {
    expect(dispatch.callCount).toBe(1);
    expect(dispatch.getCall(0).args[0].type).toBe(FETCH_DASHBOARDS_FAILED);

    fetchMock.get(fetchDashboardsEndpoint, mockDashboardData, {
      overwriteRoutes: true,
    });

    return Promise.resolve();
  });
});
