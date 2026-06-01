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
import VersionItem from '../components/VersionItem';
import type { ActivityRecord } from '../types';
import type { ActivitySaveRow } from '../utils/groupActivity';

function rec(over: Partial<ActivityRecord> = {}): ActivityRecord {
  return {
    version_uuid: 'v1',
    entity_kind: 'dashboard',
    entity_uuid: 'e1',
    entity_name: 'Sample',
    entity_deleted: false,
    entity_deletion_state: null,
    source: 'self',
    transaction_id: 7,
    issued_at: '2026-05-29T10:00:00Z',
    changed_by: null,
    kind: 'field',
    path: ['dashboard_title'],
    from_value: 'Old',
    to_value: 'New',
    summary: '',
    impact: null,
    ...over,
  };
}

function makeSave(records: ActivityRecord[]): ActivitySaveRow {
  return {
    type: 'save',
    version_uuid: records[0]?.version_uuid ?? 'v',
    transaction_id: records[0]?.transaction_id ?? 1,
    issued_at: records[0]?.issued_at ?? '2026-05-29T10:00:00Z',
    changed_by: records[0]?.changed_by ?? null,
    changes: records,
  };
}

const NO_PROPS = {
  entityType: 'dashboard' as const,
  selected: false,
  isCurrent: false,
  onSelect: () => undefined,
  onRestore: () => undefined,
};

test('VersionItem renders a kind-aware leading icon', () => {
  render(
    <VersionItem
      {...NO_PROPS}
      save={makeSave([rec({ kind: 'layout', path: ['edit', 'chart', 'c-1'] })])}
    />,
    { useRedux: true },
  );
  expect(screen.getByTestId('version-item-icon')).toBeInTheDocument();
});

test('VersionItem prefers a backend-supplied summary over reconstruction', () => {
  // Self records normally carry an empty ``summary``, but the contract
  // permits non-empty ones — when present they must win over the
  // ``formatChangeTitle`` reconstruction.
  render(
    <VersionItem
      {...NO_PROPS}
      save={makeSave([
        rec({
          kind: 'field',
          path: ['dashboard_title'],
          summary: 'Custom backend summary',
        }),
      ])}
    />,
    { useRedux: true },
  );
  expect(screen.getByText('Custom backend summary')).toBeInTheDocument();
});

test('VersionItem surfaces aggregated impact charts when present', () => {
  render(
    <VersionItem
      {...NO_PROPS}
      save={makeSave([
        rec({ impact: { charts: 3 } }),
        rec({ impact: { charts: 4 }, path: ['description'] }),
      ])}
    />,
    { useRedux: true },
  );
  // 3 + 4 — the impact aggregator sums across leaves so the user sees
  // total reach, not just the first leaf's number.
  expect(screen.getByLabelText(/Impact: 7 charts/)).toBeInTheDocument();
});

test('VersionItem hides the impact tooltip when no chart impact is reported', () => {
  render(<VersionItem {...NO_PROPS} save={makeSave([rec()])} />, {
    useRedux: true,
  });
  expect(screen.queryByTestId('version-item-impact')).toBeNull();
});
