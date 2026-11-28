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
import { QueryFormMetric } from '@superset-ui/core';
import levelsToMirrors, {
  countMetric,
  defaultSort,
  rowColumns,
  sortableColumns,
} from './levelsToMirrors';
import { TreeLevel, TreeMirrors } from './types';

const session: TreeLevel = {
  key: 'session',
  name: 'Session',
  name_plural: 'Sessions',
  id_column: 'session_id',
  time_column: 'session_started_at',
  columns: ['channel', 'duration_ms', 'step_count', 'outcome'],
  detail_fields: ['channel_key', 'inbound_number'],
  sort: ['duration_ms', false],
};

const step: TreeLevel = {
  key: 'step',
  name: 'Step',
  id_column: 'step_id',
  parent_column: 'session_id',
  time_column: 'step_started_at',
  columns: ['item_desc', 'item_label', 'step', 'step_duration_ms'],
  detail_fields: ['result'],
  sort: ['step', true],
  children_shown: 100,
  apply_date_filter: false,
};

const action: TreeLevel = {
  key: 'action',
  name: 'Action',
  id_column: 'action_id',
  parent_column: 'step_id',
  columns: ['action_type'],
  detail_fields: ['action_payload'],
  children_shown: 50,
  apply_date_filter: true,
};

type Query = {
  columns?: string[];
  metrics?: QueryFormMetric[];
  orderby?: [string, boolean][];
};

function freezeValue(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map(key => [key, item[key]]),
        )
      : item,
  );
}

function plannedQueries(levels: TreeLevel[]): Query[] {
  const [parent, ...children] = levels;
  const both = (columns: string[]): [string, boolean][] =>
    columns.flatMap(column => [
      [column, true],
      [column, false],
    ]);
  const queries: Query[] = [
    { columns: rowColumns(parent), orderby: [defaultSort(parent)] },
    { columns: rowColumns(parent) },
    ...both(sortableColumns(parent)).map(sort => ({
      columns: rowColumns(parent),
      orderby: [sort],
    })),
  ];
  children.forEach(level => {
    const link: [string, boolean] = [level.parent_column as string, true];
    [defaultSort(level), ...both(sortableColumns(level))].forEach(sort => {
      queries.push({ columns: rowColumns(level), orderby: [link, sort] });
    });
    queries.push({
      columns: [level.parent_column as string],
      metrics: [countMetric(level)],
    });
  });
  queries.push({
    columns: levels.flatMap(rowColumns),
    orderby: levels.flatMap(level => [
      defaultSort(level),
      [level.id_column, true] as [string, boolean],
    ]),
  });
  return queries;
}

function missingFromMirrors(queries: Query[], mirrors: TreeMirrors) {
  const allowed = {
    columns: new Set(mirrors.tree_columns.map(freezeValue)),
    metrics: new Set(mirrors.tree_metrics.map(freezeValue)),
    orderby: new Set(mirrors.tree_orderby.map(freezeValue)),
  };
  return queries.flatMap(query =>
    (['columns', 'metrics', 'orderby'] as const).flatMap(key =>
      (query[key] ?? [])
        .map(freezeValue)
        .filter(value => !allowed[key].has(value))
        .map(value => `${key}: ${value}`),
    ),
  );
}

test('rowColumns lists ID, parent, columns and detail fields once, in order', () => {
  expect(
    rowColumns({
      ...step,
      columns: ['step', 'step_id', 'session_id'],
      detail_fields: ['step', 'result', ''],
    }),
  ).toEqual(['step_id', 'session_id', 'step', 'result']);
});

test('sortableColumns lists the ID column and Columns once', () => {
  expect(
    sortableColumns({ ...session, columns: ['session_id', 'channel'] }),
  ).toEqual(['session_id', 'channel']);
});

test('defaultSort is the level sort, else the ID column ascending', () => {
  expect(defaultSort(session)).toEqual(['duration_ms', false]);
  expect(defaultSort(action)).toEqual(['action_id', true]);
});

test('countMetric counts the distinct level IDs', () => {
  expect(countMetric(step)).toEqual({
    expressionType: 'SIMPLE',
    aggregate: 'COUNT_DISTINCT',
    column: { column_name: 'step_id' },
    label: 'COUNT_DISTINCT(step_id)',
  });
});

test('levelsToMirrors keeps level order, dedupes and leaves time columns out', () => {
  const mirrors = levelsToMirrors([session, step]);
  expect(mirrors.tree_columns).toEqual([
    'session_id',
    'channel',
    'duration_ms',
    'step_count',
    'outcome',
    'channel_key',
    'inbound_number',
    'step_id',
    'item_desc',
    'item_label',
    'step',
    'step_duration_ms',
    'result',
  ]);
  expect(mirrors.tree_columns).not.toContain('session_started_at');
  expect(mirrors.tree_columns).not.toContain('step_started_at');
  expect(mirrors.tree_metrics).toEqual([countMetric(step)]);
  expect(mirrors.tree_orderby.slice(0, 4)).toEqual([
    ['session_id', true],
    ['session_id', false],
    ['channel', true],
    ['channel', false],
  ]);
  expect(new Set(mirrors.tree_orderby.map(freezeValue)).size).toBe(
    mirrors.tree_orderby.length,
  );
});

test('a level with no ID column adds nothing', () => {
  const empty: TreeLevel = {
    key: 'empty',
    name: 'Empty',
    id_column: '',
    parent_column: 'session_id',
    columns: ['x'],
    detail_fields: ['y'],
  };
  expect(levelsToMirrors([session, empty])).toEqual(levelsToMirrors([session]));
  expect(levelsToMirrors([])).toEqual({
    tree_columns: [],
    tree_metrics: [],
    tree_orderby: [],
  });
});

test('criterion 8: every planned query of two levels is inside the mirrors', () => {
  const levels = [session, step];
  expect(
    missingFromMirrors(plannedQueries(levels), levelsToMirrors(levels)),
  ).toEqual([]);
});

test('criterion 8: every planned query of three levels is inside the mirrors', () => {
  const levels = [session, step, action];
  expect(
    missingFromMirrors(plannedQueries(levels), levelsToMirrors(levels)),
  ).toEqual([]);
});

test('criterion 8 guard catches a column outside Levels', () => {
  const levels = [session, step];
  const queries = [...plannedQueries(levels), { columns: ['num_boys'] }];
  expect(missingFromMirrors(queries, levelsToMirrors(levels))).toEqual([
    'columns: "num_boys"',
  ]);
});

// Pasted into tests/integration_tests/charts/data/tree_table_guest_tests.py
// and tests/unit_tests/security/manager_test.py: keep the three in step.
test('birth_names levels give the mirrors the guest tests paste', () => {
  const levels: TreeLevel[] = [
    {
      key: 'level-1',
      name: 'State',
      id_column: 'state',
      time_column: 'ds',
      columns: ['gender'],
      detail_fields: [],
    },
    {
      key: 'level-2',
      name: 'Name',
      id_column: 'name',
      parent_column: 'state',
      columns: ['num'],
      detail_fields: [],
      children_shown: 100,
      apply_date_filter: false,
    },
  ];
  expect(levelsToMirrors(levels)).toEqual({
    tree_columns: ['state', 'gender', 'name', 'num'],
    tree_metrics: [
      {
        expressionType: 'SIMPLE',
        aggregate: 'COUNT_DISTINCT',
        column: { column_name: 'name' },
        label: 'COUNT_DISTINCT(name)',
      },
    ],
    tree_orderby: [
      ['state', true],
      ['state', false],
      ['gender', true],
      ['gender', false],
      ['name', true],
      ['name', false],
      ['num', true],
      ['num', false],
    ],
  });
});

test('a child linked by its own column gets that column in columns and both sort directions', () => {
  const levels = [session, { ...step, parent_column: 'session_fk' }];
  const mirrors = levelsToMirrors(levels);
  expect(mirrors.tree_columns).toContain('session_fk');
  expect(mirrors.tree_orderby).toContainEqual(['session_fk', true]);
  expect(mirrors.tree_orderby).toContainEqual(['session_fk', false]);
  expect(missingFromMirrors(plannedQueries(levels), mirrors)).toEqual([]);
});
