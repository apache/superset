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

/**
 * @fileoverview The reviewer is shown what each field moved from and to.
 *
 * The panel used to decide how to draw a field from lists of names: a
 * field the lists did not know drew as the bare word "Changed", and a text
 * field cleared to nothing drew a blank where "after" belongs, because
 * `String(value ?? '—')` does not catch the empty string. The server now
 * sends each field's before and after, or the entries that moved inside
 * it; this draws whichever it was sent.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import ChangeList from './ChangeList';
import type { FieldChange } from './types';

const draw = (changes: FieldChange[]) => render(<ChangeList changes={changes} />);

test('a field nobody has heard of is drawn with both of its values', () => {
  // The property that retires the whole class: no field name is needed for
  // the reviewer to see what it was and what it becomes.
  draw([{ field: 'brand_new_setting', before: 'old value', after: 'new value' }]);

  expect(screen.getByText('brand_new_setting')).toBeInTheDocument();
  expect(screen.getByText('old value')).toBeInTheDocument();
  expect(screen.getByText('new value')).toBeInTheDocument();
  expect(screen.queryByText('Changed')).not.toBeInTheDocument();
});

test('a text field cleared to nothing draws a dash for its after, not a blank', () => {
  // C21. `String('' ?? '—')` is `''`, so the after line was empty.
  draw([{ field: 'dashboard_title', before: 'Revenue', after: '' }]);

  expect(screen.getByText('Revenue')).toBeInTheDocument();
  expect(screen.getByText('—')).toBeInTheDocument();
});

test('a setting that moved inside an object is drawn with its two values', () => {
  draw([
    {
      field: 'label_colors',
      opaque: true,
      keys: ['Sales'],
      entries: [{ kind: 'changed', key: 'Sales', before: '#111111', after: '#ff0000' }],
    },
  ]);

  expect(screen.getByText('Sales')).toBeInTheDocument();
  expect(screen.getByText('#111111')).toBeInTheDocument();
  expect(screen.getByText('#ff0000')).toBeInTheDocument();
});

test('a filter removed is not drawn like a filter added', () => {
  // C9. The server discarded `deleted`, so both read "Changed".
  draw([
    {
      field: 'native_filter_configuration',
      opaque: true,
      entries: [
        { kind: 'removed', key: 'Country', before: '{"id":"F1"}' },
        { kind: 'added', key: 'Region', after: '{"id":"F2"}' },
      ],
    },
  ]);

  expect(screen.getByText('Removed · Country')).toBeInTheDocument();
  expect(screen.getByText('Added · Region')).toBeInTheDocument();
});

test('a layout change names the chart that arrived', () => {
  // C8. Counts alone never said which chart.
  draw([
    {
      field: 'position_json',
      opaque: true,
      layout: {
        added: 1,
        removed: 0,
        changed: 1,
        components: [{ kind: 'added', type: 'CHART', name: 'Revenue by region' }],
      },
    },
  ]);

  // The header is the list's own tally. The raw `changed: 1` is the row that
  // gained the chart, which the list does not name, so it is not shown.
  expect(screen.getByTestId('layout-tally')).toHaveTextContent(/^1 added$/);
  expect(screen.getByText('chart: Revenue by region')).toBeInTheDocument();
});

test('a swap names both charts and where each went', () => {
  // The customer swapped two charts in a column and was told "2 moved".
  draw([
    {
      field: 'position_json',
      opaque: true,
      layout: {
        added: 0,
        removed: 0,
        changed: 1,
        components: [
          {
            kind: 'changed',
            type: 'CHART',
            name: 'Revenue',
            moved: true,
            details: ['position 1 → 2 in column 1 of row 1'],
          },
          {
            kind: 'changed',
            type: 'CHART',
            name: 'Churn',
            moved: true,
            details: ['position 2 → 1 in column 1 of row 1'],
          },
        ],
      },
    },
  ]);

  expect(
    screen.getByText(
      'chart: Revenue (moved; position 1 → 2 in column 1 of row 1)',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'chart: Churn (moved; position 2 → 1 in column 1 of row 1)',
    ),
  ).toBeInTheDocument();
});

test('a resize is shown as a resize, and two moves of one name both show', () => {
  draw([
    {
      field: 'position_json',
      opaque: true,
      layout: {
        added: 0,
        removed: 0,
        changed: 3,
        components: [
          { kind: 'changed', type: 'CHART', name: 'Revenue', details: ['width 4 → 12'] },
          {
            kind: 'changed',
            type: 'CHART',
            name: 'Same title',
            moved: true,
            details: ['from row 1 to row 2'],
          },
          {
            kind: 'changed',
            type: 'CHART',
            name: 'Same title',
            moved: true,
            details: ['from row 2 to row 1'],
          },
        ],
      },
    },
  ]);

  expect(screen.getByText('chart: Revenue (width 4 → 12)')).toBeInTheDocument();
  expect(
    screen.getByText('chart: Same title (moved; from row 1 to row 2)'),
  ).toBeInTheDocument();
  expect(
    screen.getByText('chart: Same title (moved; from row 2 to row 1)'),
  ).toBeInTheDocument();
  expect(screen.getAllByTestId('layout-component')).toHaveLength(3);
});

test('a list field names who joined, with the count on each side', () => {
  // C11 / C12. A bare "Changed" beside a raw key.
  draw([
    {
      field: 'viewers',
      opaque: true,
      before: 'Ann',
      after: 'Ann, Everyone',
      count: { before: 1, after: 2 },
      entries: [{ kind: 'added', key: 'Everyone' }],
    },
  ]);

  expect(screen.getByText('Viewers')).toBeInTheDocument();
  expect(screen.getByText('Added · Everyone')).toBeInTheDocument();
  expect(screen.getByText('1 before, 2 after')).toBeInTheDocument();
});

test('a restore names its version and what that version holds', () => {
  // C15. "Version 0" beside an em-dash.
  draw([
    {
      field: 'version',
      before: null,
      after: 'Version 3',
      saved_by: 'Mo Maker',
      entries: [{ kind: 'changed', key: 'dashboard_title', before: 'Old', after: 'New' }],
    },
  ]);

  expect(screen.getByText('Version 3')).toBeInTheDocument();
  expect(screen.getByText('What that version changed')).toBeInTheDocument();
  expect(screen.getByText('New')).toBeInTheDocument();
});

test('a field the server sent no detail for says so, rather than the bare word', () => {
  // sc-129075: a field with nothing to show used to draw as "Changed", which
  // a reviewer reads as a change they have been shown.
  draw([{ field: 'mystery', opaque: true }]);

  expect(screen.queryByText('Changed')).not.toBeInTheDocument();
  expect(screen.getByTestId('change-undescribed')).toBeInTheDocument();
});

test('key names with no values list every name and say the values are missing', () => {
  // QA: "readable names, but no values, 'and 3 more' hides changes". Three
  // names and a count was the answer; every name and an admission is.
  const keys = ['groupby', 'metrics', 'row_limit', 'color_scheme', 'legend'];
  draw([{ field: 'params', opaque: true, keys }]);

  keys.forEach(key => expect(screen.getByText(key)).toBeInTheDocument());
  expect(screen.queryByText(/and \d+ more/)).not.toBeInTheDocument();
  expect(screen.getByTestId('change-undescribed')).toBeInTheDocument();
});

test('a long list of entries is drawn in full', () => {
  const entries = Array.from({ length: 60 }, (_, n) => ({
    kind: 'changed' as const,
    key: `setting_${n}`,
    before: `was ${n}`,
    after: `now ${n}`,
  }));
  draw([{ field: 'params', opaque: true, keys: ['setting_0'], entries }]);

  expect(screen.getAllByTestId('change-entry')).toHaveLength(60);
  expect(screen.getByText('now 59')).toBeInTheDocument();
});

test('settings written for the first time are listed, not counted', () => {
  // "76 further settings written for the first time" told a reviewer a
  // number and no settings.
  const entries = [
    { kind: 'changed' as const, key: 'legend', before: 'true', after: 'false' },
    ...Array.from({ length: 5 }, (_, n) => ({
      kind: 'added' as const,
      key: `default_${n}`,
      after: `${n}`,
    })),
  ];
  draw([{ field: 'params', opaque: true, entries }]);

  expect(screen.getAllByTestId('change-entry')).toHaveLength(6);
  expect(screen.getByText('Added · default_4')).toBeInTheDocument();
  expect(screen.queryByText(/written for the first time/)).not.toBeInTheDocument();
});

test('entries the server did not send are said to be missing, not read as the whole', () => {
  draw([
    {
      field: 'params',
      opaque: true,
      entries: [{ kind: 'changed', key: 'legend', before: 'a', after: 'b' }],
      more: 7,
    },
  ]);

  expect(screen.getByTestId('entries-not-sent')).toHaveTextContent(
    '7 further entries were not sent',
  );
});

test('a keyword says what it does, then shows its value, with no struck-out before', () => {
  draw([
    {
      field: 'delete_metric_ids',
      keyword: true,
      summary: 'Deletes 2 metrics from this dataset: total_revenue, order_count.',
      after: 'total_revenue, order_count',
      entries: [
        { kind: 'removed', key: 'total_revenue' },
        { kind: 'removed', key: 'order_count' },
      ],
    },
  ]);

  expect(screen.getByTestId('change-summary')).toHaveTextContent(
    'Deletes 2 metrics from this dataset',
  );
  expect(screen.getByText('delete_metric_ids')).toBeInTheDocument();
  expect(screen.getByText('Removed · total_revenue')).toBeInTheDocument();
  expect(screen.queryByText('—')).not.toBeInTheDocument();
});

test('a keyword and a field of the same name are both drawn', () => {
  draw([
    { field: 'override_columns', keyword: true, summary: 'Replaces columns.', after: true },
    { field: 'override_columns', before: 'a', after: 'b' },
  ]);

  expect(screen.getAllByText('override_columns')).toHaveLength(2);
});

test('the request as captured is drawn as text, in place of a change', () => {
  draw([
    {
      field: 'captured_call',
      unreadable: true,
      summary: 'The request as it was captured',
      after: '{"body": {"slice_name": "Revenue"}}',
    },
  ]);

  expect(screen.getByTestId('captured-call')).toHaveTextContent(
    '{"body": {"slice_name": "Revenue"}}',
  );
});

test('the layout header is counted from the list beneath it', () => {
  // R5-03. The server's `changed: 1` counts the row that lost a chart, which
  // the list does not name, so the header read "0 added, 1 removed, 1 moved"
  // over a single removed chart. The header is now the list's own tally.
  draw([
    {
      field: 'json_metadata',
      opaque: true,
      layout: {
        added: 0,
        removed: 1,
        changed: 1,
        components: [{ kind: 'removed', type: 'CHART', name: 'Churn' }],
      },
    },
  ]);

  expect(screen.getByTestId('layout-tally')).toHaveTextContent(/^1 removed$/);
  expect(screen.queryByText(/\bmoved\b/)).not.toBeInTheDocument();
  expect(screen.getAllByTestId('layout-component')).toHaveLength(1);
});

test('every row of the layout list is counted once in the header', () => {
  draw([
    {
      field: 'position_json',
      opaque: true,
      layout: {
        // Deliberately not the numbers the list adds up to.
        added: 9,
        removed: 9,
        changed: 9,
        components: [
          { kind: 'added', type: 'CHART', name: 'A' },
          { kind: 'added', type: 'HEADER', name: 'B' },
          { kind: 'removed', type: 'CHART', name: 'C' },
          { kind: 'changed', type: 'CHART', name: 'D', moved: true },
          { kind: 'changed', type: 'CHART', name: 'E', moved: true },
          { kind: 'changed', type: 'CHART', name: 'F', moved: true },
          // Moved *and* resized is one row, so one count.
          {
            kind: 'changed',
            type: 'CHART',
            name: 'G',
            moved: true,
            details: ['width 4 → 12'],
          },
          { kind: 'changed', type: 'CHART', name: 'H', details: ['width 4 → 8'] },
        ],
      },
    },
  ]);

  expect(screen.getByTestId('layout-tally')).toHaveTextContent(
    '2 added, 1 removed, 4 moved, 1 edited',
  );
  expect(screen.getAllByTestId('layout-component')).toHaveLength(8);
});

test('a layout that differs with nothing to name says so instead of a count', () => {
  draw([
    {
      field: 'position_json',
      opaque: true,
      layout: { added: 0, removed: 0, changed: 2, components: [] },
    },
  ]);

  expect(screen.getByTestId('layout-tally')).toHaveTextContent(
    'no chart, heading, tab or other component was added, removed or moved',
  );
  expect(screen.queryByText(/2 moved/)).not.toBeInTheDocument();
});

const SCOPES = [
  {
    kind: 'removed' as const,
    key: 'Churn · cross-filter settings',
    before: 'scope: global',
    consequence: true,
  },
  {
    kind: 'removed' as const,
    key: 'Country filter · charts in scope',
    before: 'Churn, Revenue',
    consequence: true,
  },
  {
    kind: 'removed' as const,
    key: 'Country filter · tabs in scope',
    before: 'Regional',
    consequence: true,
  },
];

test('recalculated scopes are one sentence, with the detail behind it', () => {
  draw([
    {
      field: 'json_metadata',
      opaque: true,
      layout: {
        added: 0,
        removed: 1,
        changed: 1,
        components: [{ kind: 'removed', type: 'CHART', name: 'Churn' }],
      },
      entries: [
        { kind: 'changed', key: 'color_scheme', before: 'a', after: 'b' },
        ...SCOPES,
      ],
      consequence_summary:
        'Cross-filter and native filter scopes updated for 1 removed chart (Churn)',
    },
  ]);

  // The author's own edit is a row; the consequences are not rows yet.
  expect(screen.getAllByTestId('change-entry')).toHaveLength(1);
  expect(screen.getByText('color_scheme')).toBeInTheDocument();
  expect(screen.getByTestId('consequence-summary')).toHaveTextContent(
    'updated for 1 removed chart (Churn)',
  );
  expect(
    screen.queryByText('Removed · Country filter · charts in scope'),
  ).not.toBeInTheDocument();
});

test('the recalculated values stay reachable in the same view', () => {
  // sc-129075: a summary that hides what it summarises is the original
  // complaint. Every value must be one click away.
  draw([
    {
      field: 'json_metadata',
      opaque: true,
      entries: SCOPES,
      consequence_summary: 'Cross-filter scopes updated for 1 removed chart (Churn)',
    },
  ]);

  const toggle = screen.getByTestId('consequence-toggle');
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(toggle).toHaveTextContent('Show details (3)');

  fireEvent.click(toggle);

  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getAllByTestId('change-entry')).toHaveLength(3);
  expect(
    screen.getByText('Removed · Country filter · charts in scope'),
  ).toBeInTheDocument();
  // A tab is named by its title; the id never appears.
  expect(screen.getByText('Regional')).toBeInTheDocument();
  expect(screen.queryByText(/TAB-/)).not.toBeInTheDocument();

  fireEvent.click(toggle);
  expect(screen.queryAllByTestId('change-entry')).toHaveLength(0);
});

test('a field whose only change is a recalculated scope still has its sentence', () => {
  // The scope is what moved, so the sentence must not be what goes missing.
  draw([
    {
      field: 'json_metadata',
      opaque: true,
      entries: SCOPES,
      consequence_summary:
        '1 chart entering or leaving a scope (Revenue)',
    },
  ]);

  expect(screen.getByTestId('consequence-summary')).toHaveTextContent(
    'Revenue',
  );
  expect(screen.queryByTestId('change-undescribed')).not.toBeInTheDocument();
});

test('recalculated entries from a server that sent no sentence still get one', () => {
  draw([{ field: 'json_metadata', opaque: true, entries: SCOPES }]);

  expect(screen.getByTestId('consequence-summary')).toHaveTextContent(
    'recalculated',
  );
});
