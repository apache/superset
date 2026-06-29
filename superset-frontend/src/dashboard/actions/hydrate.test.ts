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
import { useDashboardStateStore } from 'src/dashboard/stores';
import { hydrateDashboard } from './hydrate';

// buildDashboardLayout walks real position_data and the chart registry; stub it
// so this test can focus on what hydrateDashboard seeds into the Zustand store.
jest.mock('src/dashboard/util/buildDashboardLayout', () => ({
  __esModule: true,
  default: () => ({
    layout: { ROOT_ID: { type: 'ROOT', id: 'ROOT_ID', children: [] } },
    chartQueries: {},
    slices: {},
    sliceIds: new Set<number>(),
  }),
}));

const buildDashboard = (changedOn: string) =>
  ({
    id: 7,
    dashboard_title: 'Test dashboard',
    published: true,
    owners: [],
    changed_on: changedOn,
    metadata: {},
    position_data: {},
  }) as unknown as Parameters<typeof hydrateDashboard>[0]['dashboard'];

const getState = () => ({
  user: { userId: 1, roles: { Admin: [['can_write', 'Dashboard']] } },
  common: { conf: {} },
});

const run = (changedOn: string) =>
  hydrateDashboard({
    history: { replace: jest.fn() } as never,
    dashboard: buildDashboard(changedOn),
    charts: [],
    dataMask: {},
    activeTabs: null,
    chartStates: null,
  })(jest.fn() as never, getState as never);

test('seeds lastModifiedTime as numeric 0, not the changed_on string', () => {
  // A non-numeric seed makes the Header's Math.max(lastModifiedTime, ...) NaN.
  run('2024-03-14 09:26:53');
  const { lastModifiedTime } = useDashboardStateStore.getState();
  expect(lastModifiedTime).toBe(0);
  expect(Number.isNaN(Math.max(lastModifiedTime, 1700000000))).toBe(false);
});
