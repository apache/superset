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
  render,
  screen,
  selectOption,
  userEvent,
} from 'spec/helpers/testing-library';
import type {
  ActivityRecord,
  SaveGroup,
  TimelineEntry,
  VersionedEntityType,
} from './types';
import type { UseVersionActivityResult } from './useVersionActivity';
import VersionHistoryPanel, {
  VersionHistoryPanelProps,
} from './VersionHistoryPanel';

const record = (overrides: Partial<ActivityRecord> = {}): ActivityRecord => ({
  version_uuid: 'v-1',
  entity_kind: 'chart',
  entity_uuid: 'e-1',
  entity_name: 'My chart',
  entity_deleted: false,
  entity_deletion_state: null,
  source: 'self',
  transaction_id: 10,
  action_kind: null,
  issued_at: '2025-12-05T17:18:00',
  changed_by: { id: 1, first_name: 'Ada', last_name: 'Lovelace' },
  kind: 'metric',
  operation: 'add',
  path: ['params', 'metrics', 'Revenue'],
  from_value: null,
  to_value: { label: 'Revenue' },
  summary: '',
  impact: null,
  ...overrides,
});

const group = (overrides: Partial<SaveGroup> = {}): SaveGroup => ({
  type: 'group',
  transactionId: 10,
  versionUuid: 'v-1',
  issuedAt: '2025-12-05T17:18:00',
  changedBy: { id: 1, first_name: 'Ada', last_name: 'Lovelace' },
  actionKind: null,
  records: [record()],
  ...overrides,
});

const activity = (
  timeline: TimelineEntry[],
  overrides: Partial<UseVersionActivityResult> = {},
): UseVersionActivityResult => ({
  records: [],
  timeline,
  count: timeline.length,
  isLoading: false,
  error: null,
  hasMore: false,
  loadMore: jest.fn(),
  refresh: jest.fn(),
  ...overrides,
});

const defaultProps = (
  timeline: TimelineEntry[],
  entityType: VersionedEntityType = 'chart',
): VersionHistoryPanelProps => ({
  entityType,
  activity: activity(timeline),
  include: 'all',
  onIncludeChange: jest.fn(),
  previewedTransactionId: null,
  onClose: jest.fn(),
  onPreview: jest.fn(),
  onRestore: jest.fn(),
  onOpenAsNew: jest.fn(),
});

test('chart groups expand to show granular action rows', async () => {
  const props = defaultProps([group()]);
  render(<VersionHistoryPanel {...props} />);

  const header = screen.getByRole('button', {
    name: 'Dec 5, 2025, 12:18 PM',
  });
  expect(header).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByText("Applied 'Revenue' metric")).not.toBeInTheDocument();

  await userEvent.click(header);
  expect(header).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText("Applied 'Revenue' metric")).toBeInTheDocument();
});

test('dashboard groups show the compact category headline', () => {
  const filterRecord = record({
    entity_kind: 'dashboard',
    kind: 'filter',
    path: ['json_metadata', 'native_filter_configuration', 'NATIVE_1'],
  });
  const props = defaultProps(
    [group({ records: [filterRecord, filterRecord] })],
    'dashboard',
  );
  render(<VersionHistoryPanel {...props} />);
  expect(screen.getByText('Filters · 2 changes')).toBeInTheDocument();
});

test('the group kebab restores and forks the version', async () => {
  const saveGroup = group({
    records: [record({ entity_kind: 'dashboard', kind: 'chart' })],
  });
  const props = defaultProps([saveGroup], 'dashboard');
  render(<VersionHistoryPanel {...props} />);

  await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
  await userEvent.click(await screen.findByText('Restore this version'));
  expect(props.onRestore).toHaveBeenCalledWith(saveGroup);

  await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
  await userEvent.click(await screen.findByText('Open as new dashboard'));
  expect(props.onOpenAsNew).toHaveBeenCalledWith(saveGroup);
});

test('clicking a dashboard group header previews it', async () => {
  const saveGroup = group({
    records: [record({ entity_kind: 'dashboard', kind: 'chart' })],
  });
  const props = defaultProps([saveGroup], 'dashboard');
  render(<VersionHistoryPanel {...props} />);

  await userEvent.click(
    screen.getByRole('button', { name: 'Edit mode · 1 change' }),
  );
  expect(props.onPreview).toHaveBeenCalledWith(saveGroup);
});

test('searching filters the timeline and reports no matches', async () => {
  const props = defaultProps([group()]);
  render(<VersionHistoryPanel {...props} />);

  await userEvent.type(
    screen.getByRole('textbox', { name: 'Search actions' }),
    'zzz',
  );
  expect(screen.getByText('No actions found')).toBeInTheDocument();
  expect(screen.getByText('Try a different search term')).toBeInTheDocument();
});

test('the include filter calls back with the selected scope', async () => {
  const props = defaultProps([group()]);
  render(<VersionHistoryPanel {...props} />);

  await selectOption('Related items only', 'Filter version history');
  expect(props.onIncludeChange).toHaveBeenCalledWith('related');
});

test('an empty timeline shows the no-history empty state', () => {
  const props = defaultProps([]);
  render(<VersionHistoryPanel {...props} />);
  expect(screen.getByText('No history yet')).toBeInTheDocument();
  expect(screen.getByText('Saved changes will appear here')).toBeInTheDocument();
});

test('related rows link to the entity unless it was deleted', () => {
  const props = defaultProps([
    {
      type: 'related',
      record: record({
        source: 'related',
        entity_kind: 'dataset',
        entity_name: 'Sales',
        entity_uuid: 'ds-1',
        transaction_id: 11,
        summary: 'Dataset updated: Sales',
      }),
    },
    {
      type: 'related',
      record: record({
        source: 'related',
        entity_kind: 'chart',
        entity_name: 'Trend',
        entity_uuid: 'c-2',
        entity_deleted: true,
        transaction_id: 12,
        summary: 'Chart updated: Trend',
      }),
    },
  ]);
  props.onOpenRelated = jest.fn();
  render(<VersionHistoryPanel {...props} />);

  expect(screen.getByRole('button', { name: 'Sales' })).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Trend' }),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/\(deleted\)/)).toBeInTheDocument();
});

test('load more requests the next page', async () => {
  const loadMore = jest.fn();
  const props = defaultProps([group()]);
  props.activity = activity([group()], { hasMore: true, loadMore });
  render(<VersionHistoryPanel {...props} />);

  await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
  expect(loadMore).toHaveBeenCalled();
});

test('a restore at the head of the timeline surfaces a notice', async () => {
  const props = defaultProps([
    group({
      transactionId: 20,
      actionKind: 'restore',
      issuedAt: '2025-12-08T17:18:00',
    }),
    group(),
  ]);
  render(<VersionHistoryPanel {...props} />);

  await userEvent.click(screen.getByRole('button', { name: 'Current version' }));
  expect(
    screen.getByText('Restored version · Dec 8, 2025, 12:18 PM'),
  ).toBeInTheDocument();
});

test('the close button dismisses the panel', async () => {
  const props = defaultProps([group()]);
  render(<VersionHistoryPanel {...props} />);
  await userEvent.click(
    screen.getByRole('button', { name: 'Close version history' }),
  );
  expect(props.onClose).toHaveBeenCalled();
});
