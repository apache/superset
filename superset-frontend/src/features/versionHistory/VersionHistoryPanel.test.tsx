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
import { buildTimeline } from './grouping';
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
  onExitPreview: jest.fn(),
  onRestore: jest.fn(),
  onOpenAsNew: jest.fn(),
});

/** A pair of dashboard saves: the newest (current) and an older one. */
const dashboardPair = () => {
  const older = group({
    records: [record({ entity_kind: 'dashboard', kind: 'chart' })],
  });
  const newest = group({
    transactionId: 20,
    versionUuid: 'v-2',
    issuedAt: '2025-12-08T17:18:00',
    records: [
      record({
        entity_kind: 'dashboard',
        kind: 'chart',
        transaction_id: 20,
        issued_at: '2025-12-08T17:18:00',
      }),
    ],
  });
  return { newest, older };
};

test('chart groups expand to show granular action rows', async () => {
  const props = defaultProps([group()]);
  render(<VersionHistoryPanel {...props} />);

  const header = screen.getByRole('button', {
    name: 'Dec 5, 2025, 12:18 PM',
  });
  expect(header).toHaveAttribute('aria-expanded', 'false');
  expect(
    screen.queryByText("Applied 'Revenue' metric"),
  ).not.toBeInTheDocument();

  await userEvent.click(header);
  expect(header).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText("Applied 'Revenue' metric")).toBeInTheDocument();
});

test('long groups cap visible rows behind a show-more expander', async () => {
  const records = Array.from({ length: 12 }, (_, i) =>
    record({
      kind: 'field',
      operation: 'edit',
      path: ['params', `field_${i}`],
    }),
  );
  const props = defaultProps([group({ records })]);
  render(<VersionHistoryPanel {...props} />);

  await userEvent.click(
    screen.getByRole('button', { name: 'Dec 5, 2025, 12:18 PM' }),
  );
  expect(screen.getAllByTestId('version-history-action-row')).toHaveLength(10);

  await userEvent.click(
    screen.getByRole('button', { name: 'Show 2 more changes' }),
  );
  expect(screen.getAllByTestId('version-history-action-row')).toHaveLength(12);
});

test('search matches records hidden behind the row cap', async () => {
  const records = Array.from({ length: 12 }, (_, i) =>
    record({
      kind: 'field',
      operation: 'edit',
      path: ['params', i === 11 ? 'hidden_needle' : `field_${i}`],
    }),
  );
  const props = defaultProps([group({ records })]);
  render(<VersionHistoryPanel {...props} />);

  await userEvent.type(
    screen.getByRole('textbox', { name: 'Search actions' }),
    'hidden needle',
  );

  // The matching record is past the visible-row cap; the group must
  // still be considered a match.
  expect(screen.queryByText('No actions found')).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Dec 5, 2025, 12:18 PM' }),
  ).toBeInTheDocument();
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
  const { newest, older } = dashboardPair();
  const props = defaultProps([newest, older], 'dashboard');
  render(<VersionHistoryPanel {...props} />);

  // The newest save is the live one; act on the older save's kebab.
  const olderKebab = () =>
    screen.getAllByRole('button', { name: 'More actions' })[1];
  await userEvent.click(olderKebab());
  await userEvent.click(await screen.findByText('Restore this version'));
  expect(props.onRestore).toHaveBeenCalledWith(older);

  await userEvent.click(olderKebab());
  await userEvent.click(await screen.findByText('Open as new dashboard'));
  expect(props.onOpenAsNew).toHaveBeenCalledWith(older);
});

test('clicking a dashboard group header previews it', async () => {
  const { newest, older } = dashboardPair();
  const props = defaultProps([newest, older], 'dashboard');
  render(<VersionHistoryPanel {...props} />);

  // The newest save is the live one; previewing applies to older saves.
  await userEvent.click(
    screen.getAllByRole('button', { name: 'Edit mode · 1 change' })[1],
  );
  expect(props.onPreview).toHaveBeenCalledWith(older);
});

test('the newest save shows a Current tag and older saves do not', () => {
  const { newest, older } = dashboardPair();
  const props = defaultProps([newest, older], 'dashboard');
  render(<VersionHistoryPanel {...props} />);

  expect(screen.getAllByText('Current')).toHaveLength(1);
  const groups = screen.getAllByTestId('version-history-save-group');
  expect(groups[0]).toHaveTextContent('Current');
  expect(groups[1]).not.toHaveTextContent('Current');
});

test('selecting the current version exits an active preview instead of previewing', async () => {
  const { newest, older } = dashboardPair();
  const props = defaultProps([newest, older], 'dashboard');
  props.previewedTransactionId = older.transactionId;
  render(<VersionHistoryPanel {...props} />);

  await userEvent.click(
    screen.getAllByRole('button', { name: 'Edit mode · 1 change' })[0],
  );
  expect(props.onPreview).not.toHaveBeenCalled();
  expect(props.onExitPreview).toHaveBeenCalled();
});

test('the current version kebab omits restore but keeps open as new', async () => {
  const { newest, older } = dashboardPair();
  const props = defaultProps([newest, older], 'dashboard');
  render(<VersionHistoryPanel {...props} />);

  await userEvent.click(
    screen.getAllByRole('button', { name: 'More actions' })[0],
  );
  expect(await screen.findByText('Open as new dashboard')).toBeInTheDocument();
  expect(screen.queryByText('Restore this version')).not.toBeInTheDocument();
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

test('search matches summaries of records collapsed into a related row', async () => {
  const sharedFields = {
    source: 'related' as const,
    entity_kind: 'dataset' as const,
    entity_name: 'Sales',
    entity_uuid: 'ds-1',
    transaction_id: 11,
  };
  const timeline = buildTimeline([
    record({ ...sharedFields, summary: 'Dataset updated: Sales' }),
    record({
      ...sharedFields,
      path: ['metrics', 'quarterly_revenue'],
      summary: 'Dataset metric changed: quarterly_revenue',
    }),
  ]);
  const props = defaultProps(timeline);
  render(<VersionHistoryPanel {...props} />);

  await userEvent.type(
    screen.getByRole('textbox', { name: 'Search actions' }),
    'quarterly_revenue',
  );

  // The term only appears in a record that was collapsed into the
  // representative row; the row must still match.
  expect(screen.queryByText('No actions found')).not.toBeInTheDocument();
  expect(screen.getByText('Dataset updated: Sales')).toBeInTheDocument();
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
  expect(
    screen.getByText('Saved changes will appear here'),
  ).toBeInTheDocument();
});

const relatedEntry = (overrides: Partial<ActivityRecord>): TimelineEntry => {
  const relatedRecord = record({ source: 'related', ...overrides });
  return { type: 'related', record: relatedRecord, records: [relatedRecord] };
};

test('related rows link to the entity unless it was deleted', () => {
  const props = defaultProps([
    relatedEntry({
      entity_kind: 'dataset',
      entity_name: 'Sales',
      entity_uuid: 'ds-1',
      transaction_id: 11,
      summary: 'Dataset updated: Sales',
    }),
    relatedEntry({
      entity_kind: 'chart',
      entity_name: 'Trend',
      entity_uuid: 'c-2',
      entity_deleted: true,
      transaction_id: 12,
      summary: 'Chart updated: Trend',
    }),
  ]);
  props.onOpenRelated = jest.fn();
  render(<VersionHistoryPanel {...props} />);

  expect(screen.getByRole('button', { name: 'Sales' })).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Trend' }),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/\(deleted\)/)).toBeInTheDocument();
});

test('same-transaction related cascades roll up into one pluralized row', async () => {
  const timeline = buildTimeline(
    Array.from({ length: 10 }, (_, i) =>
      record({
        source: 'related',
        entity_kind: 'chart',
        entity_uuid: `c-${i}`,
        entity_name: `Chart ${i}`,
        transaction_id: 30,
        summary: `Chart updated: Chart ${i}`,
      }),
    ),
  );
  const props = defaultProps(timeline);
  render(<VersionHistoryPanel {...props} />);

  expect(screen.getAllByTestId('version-history-related-row')).toHaveLength(1);
  const headline = screen.getByText('10 charts updated');

  // The rolled-up entity names are listed in a tooltip.
  await userEvent.hover(headline);
  expect(await screen.findByText('Chart 7')).toBeInTheDocument();

  // Search still matches records collapsed into the rollup.
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Search actions' }),
    'Chart 3',
  );
  expect(screen.queryByText('No actions found')).not.toBeInTheDocument();
  expect(screen.getByText('10 charts updated')).toBeInTheDocument();
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

  await userEvent.click(
    screen.getByRole('button', { name: 'Current version' }),
  );
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
