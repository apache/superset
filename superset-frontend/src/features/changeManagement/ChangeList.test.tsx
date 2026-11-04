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

import { render, screen } from 'spec/helpers/testing-library';
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

test('only a field with nothing to show falls back to the bare word', () => {
  draw([{ field: 'mystery', opaque: true }]);

  expect(screen.getByText('Changed')).toBeInTheDocument();
});

test('the keys are still summarised when nothing more was sent', () => {
  draw([{ field: 'params', opaque: true, keys: ['groupby', 'metrics'] }]);

  expect(screen.getByText('groupby, metrics')).toBeInTheDocument();
});
