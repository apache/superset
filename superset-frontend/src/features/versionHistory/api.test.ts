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
import { createDashboardFromSnapshot } from './api';
import type { DashboardVersionSnapshot, VersionMeta } from './types';

const versionMeta: VersionMeta = {
  version_uuid: 'version-uuid',
  version_number: 3,
  transaction_id: 12,
  operation_type: 'update',
  issued_at: '2025-12-05T17:18:00',
  changed_by: null,
  changes: [],
};

const positions = {
  ROOT_ID: { type: 'ROOT', id: 'ROOT_ID', children: ['GRID_ID'] },
  'CHART-abc': {
    type: 'CHART',
    id: 'CHART-abc',
    children: [],
    meta: { chartId: 101, uuid: 'chart-101-uuid', width: 4, height: 50 },
  },
};

const snapshot: DashboardVersionSnapshot = {
  dashboard_title: 'Sales overview',
  position_json: JSON.stringify(positions),
  json_metadata: JSON.stringify({ color_scheme: 'supersetColors' }),
  css: '.dashboard { color: red; }',
  slug: null,
  certified_by: null,
  uuid: 'dash-uuid',
  _version: versionMeta,
};

const LIST_ENDPOINT = 'glob:*/api/v1/dashboard/?q=*';
const CHART_LIST_ENDPOINT = 'glob:*/api/v1/chart/?q=*';
const COPY_ENDPOINT = 'glob:*/api/v1/dashboard/42/copy/';

afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

test('createDashboardFromSnapshot copies via the source dashboard with snapshot layout', async () => {
  fetchMock.get(LIST_ENDPOINT, { result: [{ id: 42 }], count: 1 });
  fetchMock.get(CHART_LIST_ENDPOINT, { result: [{ id: 101 }], count: 1 });
  fetchMock.post(
    COPY_ENDPOINT,
    { result: { id: 77, last_modified_time: 1 } },
    { name: 'post-copy' },
  );

  const newId = await createDashboardFromSnapshot(
    'dash-uuid',
    snapshot,
    'Sales overview (copy from Dec 5)',
  );

  expect(newId).toBe(77);
  const calls = fetchMock.callHistory.calls('post-copy');
  expect(calls).toHaveLength(1);
  const payload = JSON.parse(calls[0].options.body as string);
  expect(payload.dashboard_title).toBe('Sales overview (copy from Dec 5)');
  expect(payload.css).toBe('.dashboard { color: red; }');
  // The copy endpoint derives the new dashboard's chart associations
  // from the `positions` key of json_metadata; the snapshot layout must
  // be embedded there so the fork references the snapshot's charts.
  const metadata = JSON.parse(payload.json_metadata);
  expect(metadata.color_scheme).toBe('supersetColors');
  expect(metadata.positions).toEqual(positions);
});

test('createDashboardFromSnapshot swaps deleted-chart slots for placeholders', async () => {
  const positionsWithDeleted = {
    ...positions,
    'CHART-dead': {
      type: 'CHART',
      id: 'CHART-dead',
      children: [],
      meta: { chartId: 999, uuid: 'chart-999-uuid', width: 4, height: 50 },
    },
  };
  fetchMock.get(LIST_ENDPOINT, { result: [{ id: 42 }], count: 1 });
  // Only chart 101 still resolves; 999 was deleted since the snapshot.
  fetchMock.get(CHART_LIST_ENDPOINT, { result: [{ id: 101 }], count: 1 });
  fetchMock.post(
    COPY_ENDPOINT,
    { result: { id: 79, last_modified_time: 1 } },
    { name: 'post-copy-deleted' },
  );

  await createDashboardFromSnapshot(
    'dash-uuid',
    { ...snapshot, position_json: JSON.stringify(positionsWithDeleted) },
    'Copy with deleted chart',
  );

  const calls = fetchMock.callHistory.calls('post-copy-deleted');
  const metadata = JSON.parse(
    JSON.parse(calls[0].options.body as string).json_metadata,
  );
  // The copy endpoint silently skips chart associations it cannot
  // resolve, which would leave a dead slot in the forked layout; the
  // payload must carry the same placeholder the preview renders instead
  // of the dead chart reference.
  expect(metadata.positions['CHART-dead']).toEqual({
    type: 'MARKDOWN',
    id: 'CHART-dead',
    children: [],
    meta: { width: 4, height: 50, code: 'This chart no longer exists.' },
  });
  expect(metadata.positions['CHART-abc']).toEqual(positions['CHART-abc']);
});

test('createDashboardFromSnapshot sends empty layout fields as-is', async () => {
  fetchMock.get(LIST_ENDPOINT, { result: [{ id: 42 }], count: 1 });
  fetchMock.post(
    COPY_ENDPOINT,
    { result: { id: 78, last_modified_time: 1 } },
    { name: 'post-copy-empty' },
  );

  await createDashboardFromSnapshot(
    'dash-uuid',
    { ...snapshot, position_json: null, json_metadata: null, css: null },
    'Bare copy',
  );

  const calls = fetchMock.callHistory.calls('post-copy-empty');
  const payload = JSON.parse(calls[0].options.body as string);
  expect(payload.css).toBe('');
  expect(JSON.parse(payload.json_metadata)).toEqual({});
});

test('createDashboardFromSnapshot rejects when the source dashboard is gone', async () => {
  fetchMock.get(LIST_ENDPOINT, { result: [], count: 0 });

  await expect(
    createDashboardFromSnapshot('dash-uuid', snapshot, 'Orphan copy'),
  ).rejects.toThrow('No dashboard found for uuid dash-uuid');
});
