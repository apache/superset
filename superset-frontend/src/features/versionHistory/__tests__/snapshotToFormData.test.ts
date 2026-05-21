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
import { snapshotToFormData } from '../utils/snapshotToFormData';
import { VersionSnapshot } from '../types';

test('snapshotToFormData returns null for a missing snapshot', () => {
  expect(snapshotToFormData(null, undefined)).toBeNull();
});

test('snapshotToFormData parses stringified params and overlays scalar fields', () => {
  const snapshot = {
    version_uuid: 'v1',
    version_number: 1,
    transaction_id: 1,
    operation_type: 'update',
    issued_at: '2026-01-01T00:00:00Z',
    changed_by: null,
    viz_type: 'big_number_total',
    slice_name: 'Snapshot name',
    params: JSON.stringify({ metric: 'count', row_limit: 50 }),
    datasource_id: 7,
    datasource_type: 'table',
  } as unknown as VersionSnapshot;

  const result = snapshotToFormData(snapshot, {
    viz_type: 'live_type',
    extra: 'kept-from-current',
  } as unknown as Parameters<typeof snapshotToFormData>[1]);

  expect(result).not.toBeNull();
  // Snapshot scalar fields override the live form_data.
  expect(result?.viz_type).toBe('big_number_total');
  // Parsed params merge in.
  expect((result as unknown as { metric: string }).metric).toBe('count');
  expect((result as unknown as { row_limit: number }).row_limit).toBe(50);
  // Unrelated live fields survive the merge.
  expect((result as unknown as { extra: string }).extra).toBe(
    'kept-from-current',
  );
  // Datasource is rebuilt from id + type.
  expect((result as unknown as { datasource: string }).datasource).toBe(
    '7__table',
  );
});
