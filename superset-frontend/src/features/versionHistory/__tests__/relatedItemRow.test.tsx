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
import { render, screen } from 'spec/helpers/testing-library';
import RelatedItemRow from '../components/RelatedItemRow';
import { ActivityRecord } from '../types';

function rec(over: Partial<ActivityRecord> = {}): ActivityRecord {
  return {
    version_uuid: 'v',
    entity_kind: 'dataset',
    entity_uuid: 'ds-1',
    entity_name: 'sales',
    entity_deleted: false,
    entity_deletion_state: null,
    source: 'related',
    transaction_id: 1,
    issued_at: '2026-05-29T10:00:00Z',
    changed_by: null,
    kind: 'field',
    path: ['schema'],
    from_value: null,
    to_value: 'public',
    summary: 'Dataset updated: sales',
    impact: { charts: 4 },
    ...over,
  };
}

test('RelatedItemRow renders the backend summary when present', () => {
  render(<RelatedItemRow record={rec()} />, { useRedux: true });
  expect(screen.getByText('Dataset updated: sales')).toBeInTheDocument();
});

test('RelatedItemRow falls back to a kind-prefixed label when summary is empty', () => {
  render(
    <RelatedItemRow record={rec({ summary: '', entity_name: 'sales' })} />,
    {
      useRedux: true,
    },
  );
  expect(screen.getByText(/Dataset updated: sales/)).toBeInTheDocument();
});

test('RelatedItemRow prefixes "(deleted)" for tombstoned entities', () => {
  render(
    <RelatedItemRow
      record={rec({ entity_deleted: true, summary: 'Dataset updated: sales' })}
    />,
    { useRedux: true },
  );
  expect(screen.getByText(/\(deleted\)/)).toBeInTheDocument();
});

test('RelatedItemRow surfaces the impact count when present', () => {
  render(<RelatedItemRow record={rec({ impact: { charts: 7 } })} />, {
    useRedux: true,
  });
  expect(screen.getByLabelText(/Impact: 7 charts/)).toBeInTheDocument();
});

test('RelatedItemRow omits the impact icon when no charts are affected', () => {
  render(<RelatedItemRow record={rec({ impact: null })} />, {
    useRedux: true,
  });
  expect(screen.queryByLabelText(/Impact:/)).toBeNull();
});
