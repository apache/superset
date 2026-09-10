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
import { store } from 'src/views/store';
import { dashboardInfoChanged } from 'src/dashboard/actions/dashboardInfo';
import { notifyLocationChanged } from 'src/core/navigation';
import getActiveDashboardId from './getActiveDashboardId';

test('declares itself read-only and non-destructive', () => {
  expect(getActiveDashboardId.annotations).toEqual({
    readOnlyHint: true,
    destructiveHint: false,
  });
});

test('reports the active dashboard id while on the dashboard page', () => {
  notifyLocationChanged('/dashboard/7/');
  store.dispatch(dashboardInfoChanged({ id: 7 }));

  expect(getActiveDashboardId.handler({})).toEqual({
    success: true,
    dashboardId: 7,
  });
});

test('reports no active dashboard once navigation leaves the dashboard page', () => {
  notifyLocationChanged('/dashboard/7/');
  store.dispatch(dashboardInfoChanged({ id: 7 }));

  notifyLocationChanged('/sqllab/');

  expect(getActiveDashboardId.handler({})).toEqual({
    success: false,
    message: 'No dashboard is currently active',
  });
});

test('reports no active dashboard before any dashboard has ever hydrated', () => {
  notifyLocationChanged('/dashboard/8/');
  store.dispatch(dashboardInfoChanged({ id: undefined }));

  expect(getActiveDashboardId.handler({})).toEqual({
    success: false,
    message: 'No dashboard is currently active',
  });
});
