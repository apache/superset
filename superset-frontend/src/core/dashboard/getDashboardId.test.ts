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
import { dashboard } from '.';

test('returns the hydrated dashboard id while on the dashboard page', () => {
  notifyLocationChanged('/dashboard/42/');
  store.dispatch(dashboardInfoChanged({ id: 42 }));

  expect(dashboard.getDashboardId()).toBe(42);
});

test('returns undefined once navigation leaves the dashboard page, even though dashboardInfo is never reset', () => {
  notifyLocationChanged('/dashboard/42/');
  store.dispatch(dashboardInfoChanged({ id: 42 }));
  expect(dashboard.getDashboardId()).toBe(42);

  // dashboardInfo has no reset-on-navigation action — it only ever merges —
  // so an in-SPA navigation away from the dashboard leaves state.dashboardInfo.id
  // stale. getDashboardId() must not surface that stale id once the page changes.
  notifyLocationChanged('/sqllab/');

  expect(dashboard.getDashboardId()).toBeUndefined();
});

test('the dashboard list page does not count as being on a dashboard', () => {
  notifyLocationChanged('/dashboard/42/');
  store.dispatch(dashboardInfoChanged({ id: 42 }));
  expect(dashboard.getDashboardId()).toBe(42);

  // `/dashboard/list/` matches the dashboard detail route pattern too
  // (`/dashboard/:idOrSlug/`) unless the list route is checked first — this
  // guards against that regression via the real navigation module, not a
  // hand-rolled pathname check.
  notifyLocationChanged('/dashboard/list/');

  expect(dashboard.getDashboardId()).toBeUndefined();
});
