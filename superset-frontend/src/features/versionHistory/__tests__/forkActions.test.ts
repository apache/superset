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
  forkChartFromSnapshot,
  forkDashboardFromSnapshot,
} from '../utils/forkActions';

jest.mock('@superset-ui/core', () => {
  const actual = jest.requireActual('@superset-ui/core');
  return {
    ...actual,
    SupersetClient: { post: jest.fn() },
  };
});

const mockPost = SupersetClient.post as jest.MockedFunction<
  typeof SupersetClient.post
>;

beforeEach(() => {
  mockPost.mockReset();
});

test('forkChartFromSnapshot POSTs slice + params + datasource and returns the new id', async () => {
  mockPost.mockResolvedValueOnce({
    json: { id: 42 },
  } as unknown as Awaited<ReturnType<typeof SupersetClient.post>>);

  const result = await forkChartFromSnapshot({
    version_uuid: 'v-1',
    version_number: 3,
    transaction_id: 7,
    operation_type: 'update',
    issued_at: '2026-05-01T12:00:00Z',
    changed_by: null,
    slice_name: 'Monthly revenue',
    viz_type: 'bar',
    params: '{"metric":"count"}',
    query_context: '{"queries":[]}',
    datasource_id: 11,
    datasource_type: 'table',
  } as Parameters<typeof forkChartFromSnapshot>[0]);

  expect(result.id).toBe(42);
  expect(result.name).toBe('Monthly revenue (copy from 2026-05-01)');

  const call = mockPost.mock.calls[0][0];
  expect(call.endpoint).toBe('/api/v1/chart/');
  const body = JSON.parse(call.body as string);
  expect(body.slice_name).toBe('Monthly revenue (copy from 2026-05-01)');
  expect(body.viz_type).toBe('bar');
  expect(body.params).toBe('{"metric":"count"}');
  expect(body.datasource_id).toBe(11);
  expect(body.datasource_type).toBe('table');
});

test('forkChartFromSnapshot rejects when the API does not return an id', async () => {
  mockPost.mockResolvedValueOnce({ json: {} } as unknown as Awaited<
    ReturnType<typeof SupersetClient.post>
  >);
  await expect(
    forkChartFromSnapshot({
      version_uuid: 'v-1',
      version_number: 1,
      transaction_id: 1,
      operation_type: 'update',
      issued_at: '2026-01-01T00:00:00Z',
      changed_by: null,
      slice_name: 'X',
      viz_type: 'bar',
      datasource_id: 1,
      datasource_type: 'table',
    } as Parameters<typeof forkChartFromSnapshot>[0]),
  ).rejects.toThrow(/did not return an id/);
});

test('forkDashboardFromSnapshot POSTs title + position_json + json_metadata and returns the new id', async () => {
  mockPost.mockResolvedValueOnce({
    json: { id: 99 },
  } as unknown as Awaited<ReturnType<typeof SupersetClient.post>>);

  const result = await forkDashboardFromSnapshot({
    version_uuid: 'v-1',
    version_number: 2,
    transaction_id: 4,
    operation_type: 'update',
    issued_at: '2026-03-15T08:30:00Z',
    changed_by: null,
    dashboard_title: 'Sales overview',
    position_json: '{"ROOT_ID":{}}',
    json_metadata: '{}',
    css: '.foo {}',
  } as unknown as Parameters<typeof forkDashboardFromSnapshot>[0]);

  expect(result.id).toBe(99);
  expect(result.name).toBe('Sales overview (copy from 2026-03-15)');

  const call = mockPost.mock.calls[0][0];
  expect(call.endpoint).toBe('/api/v1/dashboard/');
  const body = JSON.parse(call.body as string);
  expect(body.dashboard_title).toBe('Sales overview (copy from 2026-03-15)');
  expect(body.position_json).toBe('{"ROOT_ID":{}}');
  expect(body.json_metadata).toBe('{}');
  expect(body.css).toBe('.foo {}');
});
