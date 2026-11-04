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

import { render, screen } from '@testing-library/react';
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

  expect(screen.getByText('1 added, 0 removed, 1 moved')).toBeInTheDocument();
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
