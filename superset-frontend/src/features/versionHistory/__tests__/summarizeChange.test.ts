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
import { summarizeChange } from '../utils/summarizeChange';
import { formatChangeTitle } from '../utils/formatChangeTitle';
import { Change } from '../types';

test('summarizeChange describes a layout add with the payload name', () => {
  const change: Change = {
    kind: 'layout',
    path: ['add', 'chart', 'chart-123'],
    from_value: null,
    to_value: { name: 'Monthly sales' },
  };
  expect(summarizeChange(change)).toMatch(/Added chart "Monthly sales"/);
});

test('summarizeChange describes a layout remove with no name as a bare kind', () => {
  const change: Change = {
    kind: 'layout',
    path: ['remove', 'row', 'row-1'],
    from_value: { name: undefined },
    to_value: null,
  };
  expect(summarizeChange(change)).toMatch(/Removed row/);
});

test('summarizeChange uses the field label for a scalar update', () => {
  const change: Change = {
    kind: 'field',
    path: ['dashboard_title'],
    from_value: 'Old title',
    to_value: 'New title',
  };
  expect(summarizeChange(change)).toMatch(
    /Changed dashboard title to "New title"/,
  );
});

test('summarizeChange maps color_scheme_domain → "color palette"', () => {
  const change: Change = {
    kind: 'field',
    path: ['color_scheme_domain'],
    from_value: ['#aaa'],
    to_value: ['#bbb'],
  };
  // The payload here is an array — too long for the inline value branch,
  // so we get the bare "Changed <label>" output.
  expect(summarizeChange(change)).toMatch(/Changed color palette/);
});

test('summarizeChange maps json_metadata → "dashboard settings"', () => {
  const change: Change = {
    kind: 'field',
    path: ['json_metadata'],
    from_value: '{}',
    to_value: '{"x":1}',
  };
  expect(summarizeChange(change)).toMatch(
    /Changed dashboard settings to "\{"x":1\}"/,
  );
});

test('summarizeChange maps position_json → "layout"', () => {
  const change: Change = {
    kind: 'field',
    path: ['position_json'],
    from_value: null,
    to_value: 'huge string here',
  };
  expect(summarizeChange(change)).toMatch(/Set layout to "huge string here"/);
});

test('summarizeChange falls back to a generic message for unknown shapes', () => {
  const change: Change = {
    kind: 'json',
    path: ['params', 'metrics'],
    from_value: [1, 2],
    to_value: [1, 2, 3],
  };
  expect(summarizeChange(change)).toMatch(/Changed/);
});

test('formatChangeTitle collapses additional changes into a "+N more" suffix', () => {
  const changes: Change[] = [
    {
      kind: 'field',
      path: ['slice_name'],
      from_value: 'A',
      to_value: 'B',
    },
    {
      kind: 'field',
      path: ['description'],
      from_value: null,
      to_value: 'x',
    },
    {
      kind: 'field',
      path: ['cache_timeout'],
      from_value: 30,
      to_value: 60,
    },
  ];
  expect(formatChangeTitle(changes)).toMatch(/\(\+2 more\)/);
});

test('formatChangeTitle returns Baseline for an empty diff', () => {
  expect(formatChangeTitle([])).toMatch(/Baseline/);
});

test('summarizeChange handles a Shape B edit with a deeper path', () => {
  // ``edit`` verbs may extend past length 3 once leaf-recursion is on; the
  // hard ``path.length === 3`` check was removed so the deeper detail
  // surfaces with the leaf field label.
  const change: Change = {
    kind: 'layout',
    path: ['edit', 'chart', 'chart-1', 'meta', 'sliceName'],
    from_value: 'Old',
    to_value: 'New',
  };
  // Unknown field labels fall through to the raw identifier — they aren't
  // localized, but the kind/verb is still recognizable.
  expect(summarizeChange(change)).toMatch(/Edited chart sliceName/);
});

test('summarizeChange handles a deeply nested json_metadata field', () => {
  const change: Change = {
    kind: 'field',
    path: ['json_metadata', 'global_chart_configuration', 'color_scheme'],
    from_value: 'd3Category10',
    to_value: 'preset',
  };
  // Walks the leaf label — variable-depth paths must not require any
  // hard-coded length matching.
  expect(summarizeChange(change)).toMatch(/Changed color palette to "preset"/);
});
