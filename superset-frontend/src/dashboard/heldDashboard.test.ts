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

import type { JsonObject } from '@superset-ui/core';
import type { HydrateDashboardData } from 'src/dashboard/actions/hydrate';
import { composeHeldDashboard, hasHeldDashboard } from './heldDashboard';

const live = {
  id: 1,
  dashboard_title: 'Live',
  css: 'a {}',
  owners: [{ id: 1 }],
  metadata: { color_scheme: 'live' },
  position_data: { ROOT_ID: { id: 'ROOT_ID' } },
} as unknown as HydrateDashboardData;

test('only fields that change the picture count as a held dashboard', () => {
  expect(hasHeldDashboard({ dashboard_title: 'x' })).toBe(true);
  expect(hasHeldDashboard({ theme_id: null })).toBe(true);
  expect(hasHeldDashboard({ owners: [1], roles: [2], tags: [] })).toBe(false);
  expect(hasHeldDashboard({})).toBe(false);
});

test('scalars carry across and the rest of the live dashboard stays', () => {
  const composed = composeHeldDashboard(live, { css: 'b {}', owners: [9] });
  expect(composed).toMatchObject({
    dashboard_title: 'Live',
    css: 'b {}',
    owners: [{ id: 1 }],
  });
});

test('json_metadata replaces the metadata whole rather than merging', () => {
  const composed = composeHeldDashboard(live, {
    json_metadata: JSON.stringify({ refresh_frequency: 5 }),
  });
  expect(composed?.metadata).toEqual({ refresh_frequency: 5 });
});

test('metadata with no positions leaves the live grid in place', () => {
  const composed = composeHeldDashboard(live, {
    json_metadata: JSON.stringify({ refresh_frequency: 5 }),
  });
  expect(composed?.position_data).toBe(live.position_data);
});

test('a body that does not parse is not composed', () => {
  expect(composeHeldDashboard(live, { json_metadata: 'not json' })).toBeNull();
  expect(
    composeHeldDashboard(live, { position_json: 7 } as JsonObject),
  ).toBeNull();
});

test('does not mutate the live dashboard', () => {
  const before = JSON.stringify(live);
  composeHeldDashboard(live, { dashboard_title: 'x', css: 'y' });
  expect(JSON.stringify(live)).toBe(before);
});
