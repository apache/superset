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
import { renderHook, waitFor } from '@testing-library/react';
import { SupersetClient } from '@superset-ui/core';
import { useVersionSnapshot } from '../hooks/useVersionSnapshot';

jest.mock('@superset-ui/core', () => {
  const actual = jest.requireActual('@superset-ui/core');
  return {
    ...actual,
    SupersetClient: { get: jest.fn() },
  };
});

const mockGet = SupersetClient.get as jest.MockedFunction<
  typeof SupersetClient.get
>;

beforeEach(() => {
  mockGet.mockReset();
});

test('useVersionSnapshot unwraps the SupersetClient envelope (json.result)', async () => {
  // Real backend response shape: { result: { ...snapshot } }. Without the
  // unwrap, ``snapshot.position_json`` ends up undefined and the dashboard
  // preview guard then trips with "Snapshot is missing layout structure".
  mockGet.mockResolvedValueOnce({
    json: {
      result: {
        version_uuid: '11111111-2222-3333-4444-555555555555',
        version_number: 3,
        transaction_id: 1,
        operation_type: 'update',
        issued_at: '2026-05-01T12:00:00Z',
        changed_by: null,
        position_json:
          '{"ROOT_ID":{"id":"root"},"GRID_ID":{"id":"grid"},"CHART-abc":{}}',
        dashboard_title: 'Snapshot title',
        _version: {
          version_uuid: '11111111-2222-3333-4444-555555555555',
          version_number: 3,
          changes: [],
        },
      },
    },
  } as unknown as Awaited<ReturnType<typeof SupersetClient.get>>);

  const { result } = renderHook(() =>
    useVersionSnapshot(
      'dashboard',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      '11111111-2222-3333-4444-555555555555',
    ),
  );
  await waitFor(() => {
    expect(result.current.snapshot).not.toBeNull();
  });

  // Critical: these fields must live at the root of ``snapshot``, not
  // under ``snapshot.result``.
  const snap = result.current.snapshot as Record<string, unknown>;
  expect(typeof snap.position_json).toBe('string');
  expect(snap.position_json).toContain('ROOT_ID');
  expect(snap.position_json).toContain('GRID_ID');
  expect(snap.dashboard_title).toBe('Snapshot title');
  expect(snap.issued_at).toBe('2026-05-01T12:00:00Z');
  // The result envelope should NOT be exposed as a nested field.
  expect(snap.result).toBeUndefined();

  expect(mockGet).toHaveBeenCalledWith({
    endpoint:
      '/api/v1/dashboard/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/versions/11111111-2222-3333-4444-555555555555/',
  });
});

test('useVersionSnapshot exposes null and an error message on API failure', async () => {
  mockGet.mockRejectedValueOnce(new Error('boom'));

  const { result } = renderHook(() =>
    useVersionSnapshot(
      'chart',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      '11111111-2222-3333-4444-555555555555',
    ),
  );

  await waitFor(() => {
    expect(result.current.error).not.toBeNull();
  });
  expect(result.current.snapshot).toBeNull();
});
