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
import {
  ENTER_VERSION_PREVIEW,
  EXIT_VERSION_PREVIEW,
} from 'src/dashboard/actions/dashboardState';
import dashboardInfoReducer from 'src/dashboard/reducers/dashboardInfo';

const live = {
  id: 7,
  dashboard_title: 'Live title',
  description: 'Live description',
  slug: 'live-slug',
  css: '/* live */',
  json_metadata: '{"live":true}',
  published: true,
};

test('dashboardInfo reducer applies snapshot scalar overrides on ENTER_VERSION_PREVIEW', () => {
  const next = dashboardInfoReducer(live as Parameters<
    typeof dashboardInfoReducer
  >[0], {
    type: ENTER_VERSION_PREVIEW,
    newDashboardInfo: {
      dashboard_title: 'Snapshot title',
      description: 'Snapshot description',
      css: '/* snap */',
      published: false,
    },
  } as unknown as Parameters<typeof dashboardInfoReducer>[1]);
  expect(next.dashboard_title).toBe('Snapshot title');
  expect(next.description).toBe('Snapshot description');
  expect(next.css).toBe('/* snap */');
  expect(next.published).toBe(false);
  // Unrelated fields untouched.
  expect(next.id).toBe(7);
  expect(next.slug).toBe('live-slug');
  expect(next.json_metadata).toBe('{"live":true}');
});

test('dashboardInfo reducer is a no-op on ENTER when no overrides are provided', () => {
  const next = dashboardInfoReducer(live as Parameters<
    typeof dashboardInfoReducer
  >[0], {
    type: ENTER_VERSION_PREVIEW,
    newDashboardInfo: null,
  } as unknown as Parameters<typeof dashboardInfoReducer>[1]);
  expect(next).toBe(live);
});

test('dashboardInfo reducer restores captured fields on EXIT_VERSION_PREVIEW', () => {
  // After enter, dashboardInfo has the snapshot scalars.
  const previewing = {
    ...live,
    dashboard_title: 'Snapshot title',
    description: 'Snapshot description',
    css: '/* snap */',
    published: false,
  };
  const restored = dashboardInfoReducer(previewing as Parameters<
    typeof dashboardInfoReducer
  >[0], {
    type: EXIT_VERSION_PREVIEW,
    restoreDashboardInfo: {
      dashboard_title: live.dashboard_title,
      description: live.description,
      slug: live.slug,
      css: live.css,
      json_metadata: live.json_metadata,
      published: live.published,
    },
  } as unknown as Parameters<typeof dashboardInfoReducer>[1]);
  expect(restored.dashboard_title).toBe('Live title');
  expect(restored.description).toBe('Live description');
  expect(restored.css).toBe('/* live */');
  expect(restored.published).toBe(true);
});

test('A → B switch + exit returns dashboardInfo to the original live value', () => {
  // Enter A.
  const afterA = dashboardInfoReducer(live as Parameters<
    typeof dashboardInfoReducer
  >[0], {
    type: ENTER_VERSION_PREVIEW,
    newDashboardInfo: { dashboard_title: 'A' },
  } as unknown as Parameters<typeof dashboardInfoReducer>[1]);
  expect(afterA.dashboard_title).toBe('A');
  // Enter B without exiting.
  const afterB = dashboardInfoReducer(afterA, {
    type: ENTER_VERSION_PREVIEW,
    newDashboardInfo: { dashboard_title: 'B' },
  } as unknown as Parameters<typeof dashboardInfoReducer>[1]);
  expect(afterB.dashboard_title).toBe('B');
  // Exit restoring captured original (the LIVE value, not A).
  const afterExit = dashboardInfoReducer(afterB, {
    type: EXIT_VERSION_PREVIEW,
    restoreDashboardInfo: { dashboard_title: live.dashboard_title },
  } as unknown as Parameters<typeof dashboardInfoReducer>[1]);
  expect(afterExit.dashboard_title).toBe('Live title');
});
