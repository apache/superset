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
import type { VersionMeta } from 'src/features/versionHistory/types';
import { describeCanvasVersion, versionLabel } from './describeVersion';

type Change = VersionMeta['changes'][number];

const version = (
  changes: Partial<Change>[],
  overrides: Partial<VersionMeta> = {},
): VersionMeta => ({
  version_uuid: 'v',
  version_number: 2,
  transaction_id: 3,
  operation_type: 'update',
  issued_at: '2026-11-04T12:00:00',
  changed_by: null,
  changes: changes.map(change => ({
    kind: 'widget',
    operation: 'edit',
    path: [],
    from_value: null,
    to_value: null,
    ...change,
  })),
  ...overrides,
});

test('numbers versions from 1', () => {
  expect(versionLabel(version([]))).toBe('Version 3');
});

test('names the original version and restores', () => {
  expect(
    describeCanvasVersion(version([], { operation_type: 'baseline' })),
  ).toBe('Original version');
  expect(
    describeCanvasVersion(
      version([
        {
          kind: '__meta__',
          operation: 'announce',
          path: ['__meta__'],
          to_value: { version_number: 0 },
        },
        { operation: 'add', path: ['notes'] },
      ]),
    ),
  ).toBe('Restored version 1');
});

test('counts widgets and folds in what an added widget implies', () => {
  expect(
    describeCanvasVersion(
      version([
        { operation: 'add', path: ['a'] },
        { operation: 'add', path: ['b'] },
        { kind: 'layout', path: ['a', 'layout'] },
        { operation: 'remove', path: ['c'] },
        { path: ['d', 'props', 'title'] },
      ]),
    ),
  ).toBe('Added 2 widgets · Removed 1 widget · Edited 1 widget');
});

test('summarizes layout, scopes, settings and fields', () => {
  expect(
    describeCanvasVersion(
      version([
        { operation: 'move', path: ['a'] },
        { kind: 'interaction', path: ['interactions', 'filters', 'f'] },
        { kind: 'setting', path: ['settings', 'refresh', 'interval'] },
        { kind: 'field', path: ['title'], to_value: 'Sales' },
        { kind: 'field', path: ['css'], to_value: '.x {}' },
      ]),
    ),
  ).toBe(
    'Rearranged the layout · Changed filter scopes · Changed settings · Renamed to “Sales” · Changed details',
  );
  expect(describeCanvasVersion(version([]))).toBe('Edited widget content');
});
