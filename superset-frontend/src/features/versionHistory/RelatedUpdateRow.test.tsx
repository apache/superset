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
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import type { ActivityRecord } from './types';
import RelatedUpdateRow from './RelatedUpdateRow';

const baseRecord: ActivityRecord = {
  entity_kind: 'dataset',
  entity_uuid: 'abc',
  entity_name: 'Sales Transactions',
  entity_deleted: false,
  entity_deletion_state: null,
  version_uuid: null,
  source: 'related',
  transaction_id: 100,
  action_kind: null,
  issued_at: '2026-09-03T10:00:00Z',
  changed_by: null,
  kind: 'metric',
  operation: 'update',
  path: ['metrics'],
  from_value: 'a',
  to_value: 'b',
  summary: 'Dataset updated: Sales Transactions',
  impact: {
    charts: 2,
    chart_names: [
      { id: 11, name: 'Alpha chart' },
      { id: 12, name: 'Beta chart' },
    ],
  },
};

test('hovering the impact rollup headline lists the affected chart names', async () => {
  render(<RelatedUpdateRow record={baseRecord} />);

  expect(
    screen.getByText(/Dataset used by 2 charts updated/),
  ).toBeInTheDocument();

  userEvent.hover(screen.getByText(/Dataset used by 2 charts updated/));

  expect(await screen.findByText('Alpha chart')).toBeInTheDocument();
  expect(screen.getByText('Beta chart')).toBeInTheDocument();
});

test('an impact chart with an empty name renders as Untitled in the tooltip', async () => {
  const record: ActivityRecord = {
    ...baseRecord,
    impact: {
      charts: 2,
      chart_names: [
        { id: 11, name: '' },
        { id: 12, name: 'Beta chart' },
      ],
    },
  };
  render(<RelatedUpdateRow record={record} />);

  userEvent.hover(screen.getByText(/Dataset used by 2 charts updated/));

  expect(await screen.findByText('Untitled')).toBeInTheDocument();
  expect(screen.getByText('Beta chart')).toBeInTheDocument();
});

test('a capped impact list shows an overflow line for the remaining charts', async () => {
  const record: ActivityRecord = {
    ...baseRecord,
    impact: {
      charts: 5,
      chart_names: [
        { id: 11, name: 'Alpha chart' },
        { id: 12, name: 'Beta chart' },
        { id: 13, name: 'Gamma chart' },
      ],
    },
  };
  render(<RelatedUpdateRow record={record} />);

  userEvent.hover(screen.getByText(/Dataset used by 5 charts updated/));

  expect(await screen.findByText('Alpha chart')).toBeInTheDocument();
  expect(screen.getByText('…and 2 more charts')).toBeInTheDocument();
});

test('a single-chart impact still offers the names tooltip (pinned decision)', async () => {
  // With exactly one affected chart the headline falls back to the server
  // summary, but the hover detail remains available — the single name is
  // still information the row cannot show inline.
  const record: ActivityRecord = {
    ...baseRecord,
    impact: { charts: 1, chart_names: [{ id: 11, name: 'Alpha chart' }] },
  };
  render(<RelatedUpdateRow record={record} />);

  userEvent.hover(screen.getByText(/Dataset updated/));

  expect(await screen.findByText('Alpha chart')).toBeInTheDocument();
});

test('a related record without impact names shows no tooltip', async () => {
  const record: ActivityRecord = {
    ...baseRecord,
    impact: null,
    summary: 'Dataset updated: Sales Transactions',
  };
  render(<RelatedUpdateRow record={record} />);

  userEvent.hover(screen.getByText(/Dataset updated/));

  // The tooltip mounts asynchronously; a synchronous negative query would
  // pass even if one were about to appear. Wait out the mount window and
  // require the lookup to come up empty.
  await expect(
    screen.findByRole('tooltip', {}, { timeout: 800 }),
  ).rejects.toThrow();
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
