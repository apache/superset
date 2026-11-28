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
import { GenericDataType } from '@apache-superset/core/common';
import { DataRecord, DataRecordValue } from '@superset-ui/core';
import { appendMore, keyOf, toEntries } from './childrenState';
import { TreeTableQueryResult } from './fetchTreeTableData';
import { ChildrenEntry, TreeLevel } from './types';

const step: TreeLevel = {
  key: 'step',
  name: 'Step',
  id_column: 'step_id',
  parent_column: 'session_id',
  columns: ['step'],
  detail_fields: [],
};

const session: TreeLevel = {
  key: 'session',
  name: 'Session',
  id_column: 'session_id',
  columns: [],
  detail_fields: [],
};
const levelsWith = (n: number) => [session, { ...step, children_shown: n }];
const one = (key: string) => JSON.stringify([key]);

const rowsOf = (parent: DataRecordValue, count: number): DataRecord[] =>
  Array.from({ length: count }, (_, index) => ({
    step_id: `${String(parent)}-${index}`,
    session_id: parent,
    step: index,
  }));

const answer = (
  rows: DataRecord[],
  counts: [DataRecordValue, number][],
): TreeTableQueryResult[] => [
  {
    data: rows,
    colnames: ['step_id', 'session_id', 'step'],
    coltypes: [
      GenericDataType.String,
      GenericDataType.String,
      GenericDataType.Numeric,
    ],
    rowcount: rows.length,
    sql_rowcount: rows.length,
  },
  {
    data: counts.map(([session_id, count]) => ({
      session_id,
      'COUNT_DISTINCT(step_id)': count,
    })),
    colnames: ['session_id', 'COUNT_DISTINCT(step_id)'],
    coltypes: [GenericDataType.String, GenericDataType.Numeric],
    rowcount: counts.length,
    sql_rowcount: counts.length,
  },
];

test('short rows with known counts need bounded single-path repair', () => {
  const entries = toEntries(
    Object.assign(
      answer(
        [...rowsOf('a', 2), ...rowsOf('c', 2)],
        [
          ['a', 5],
          ['b', 3],
          ['c', 2],
        ],
      ),
      { countsSeparate: true },
    ),
    { level: 1, paths: [['a'], ['b'], ['c'], ['empty']] },
    levelsWith(5),
  );
  expect(entries.ambiguous).toEqual([['a'], ['b']]);
  expect(entries.get(one('c'))?.status).toBe('loaded');
  expect(entries.get(one('empty'))?.status).toBe('empty');
});

test('keyOf gives one key per value and none for empty IDs', () => {
  expect(keyOf(5)).toBe('5');
  expect(keyOf('5')).toBe('5');
  expect(keyOf(BigInt(5))).toBe('5');
  expect(keyOf(BigInt('9007199254740993'))).toBe('9007199254740993');
  expect(keyOf(0)).toBe('0');
  expect(keyOf(null)).toBeUndefined();
  expect(keyOf(undefined)).toBeUndefined();
  expect(keyOf('')).toBeUndefined();
});

test('states follow the counts: empty, loaded, cut and missing', () => {
  const entries = toEntries(
    answer(
      [...rowsOf('b', 100), ...rowsOf('f', 10), ...rowsOf('c', 40)],
      [
        ['a', 0],
        ['b', 150],
        ['f', 10],
        ['c', 520],
      ],
    ),
    { level: 1, paths: [['a'], ['b'], ['f'], ['c'], ['missing']] },
    levelsWith(100),
  );
  expect(
    Object.fromEntries(
      [...entries].map(([key, entry]) => [
        JSON.parse(key)[0],
        [entry.status, entry.rows.length, entry.total],
      ]),
    ),
  ).toEqual({
    a: ['empty', 0, 0],
    b: ['loaded', 100, 150],
    f: ['loaded', 10, 10],
    c: ['error', 0, 520],
    missing: ['empty', 0, 0],
  });
  expect(entries.get(one('b'))?.rows.map(row => row.step)).toEqual(
    Array.from({ length: 100 }, (_, index) => index),
  );
  expect(entries.get(one('b'))?.colnames).toEqual([
    'step_id',
    'session_id',
    'step',
  ]);
});

test('a batch cut by the row limit gives error for every short parent', () => {
  const entries = toEntries(
    answer(
      [...rowsOf('s1', 20), ...rowsOf('s2', 20), ...rowsOf('s3', 5)],
      [
        ['s1', 20],
        ['s2', 30],
        ['s3', 50],
        ['s4', 7],
      ],
    ),
    { level: 1, paths: [['s1'], ['s2'], ['s3'], ['s4']] },
    levelsWith(20),
  );
  expect(
    [...entries].map(([key, entry]) => [JSON.parse(key)[0], entry.status]),
  ).toEqual([
    ['s1', 'loaded'],
    ['s2', 'loaded'],
    ['s3', 'error'],
    ['s4', 'error'],
  ]);
});

test('numeric, string and BigInt parent IDs land under the same key', () => {
  const big = BigInt('9007199254740993');
  const entries = toEntries(
    answer(
      [...rowsOf(5, 1), ...rowsOf(big, 2), ...rowsOf('x', 1)],
      [
        [5, 1],
        [big, 2],
        ['x', 1],
      ],
    ),
    { level: 1, paths: [['5'], ['9007199254740993'], ['x']] },
    levelsWith(100),
  );
  expect(entries.get(one('5'))).toMatchObject({ status: 'loaded', total: 1 });
  expect(entries.get(one('9007199254740993'))).toMatchObject({
    status: 'loaded',
    total: 2,
  });
  expect(entries.get(one('9007199254740993'))?.rows).toHaveLength(2);
  expect(entries.get(one('x'))?.rows).toHaveLength(1);
});

test('appendMore appends the rows in order and clears more', () => {
  const entry: ChildrenEntry = {
    status: 'loaded',
    rows: [{ step_id: 'a' }, { step_id: 'b' }],
    total: 4,
    colnames: ['step_id'],
    coltypes: [GenericDataType.String],
    more: 'loading',
  };
  const next = appendMore(entry, [
    {
      data: [{ step_id: 'c' }, { step_id: 'd' }],
      colnames: ['step_id'],
      coltypes: [GenericDataType.String],
      rowcount: 2,
      sql_rowcount: 2,
    },
  ]);
  expect(next.rows.map(row => row.step_id)).toEqual(['a', 'b', 'c', 'd']);
  expect(next).not.toHaveProperty('more');
  expect(next.total).toBe(4);
  expect(entry.rows).toHaveLength(2);
});

const queue: TreeLevel = {
  key: 'queue',
  name: 'Queue',
  id_column: 'queue',
  columns: [],
  detail_fields: [],
};
const agent: TreeLevel = {
  key: 'agent',
  name: 'Agent',
  id_column: 'agent',
  parent_column: 'queue',
  columns: [],
  detail_fields: [],
};
const interaction: TreeLevel = {
  key: 'interaction',
  name: 'Interaction',
  id_column: 'interaction_id',
  parent_column: 'agent',
  columns: ['channel'],
  detail_fields: [],
};
const s4 = [queue, agent, interaction];
const interactionsOf = (queueName: string, agentName: string, count: number) =>
  Array.from({ length: count }, (_, index) => ({
    interaction_id: `${queueName}/${agentName}/${index}`,
    agent: agentName,
    queue: queueName,
    channel: 'voice',
  }));
const fourLevelAnswer = (
  rows: DataRecord[],
  counts: [string, string, number][],
  sqlRowcount = rows.length,
): TreeTableQueryResult[] => [
  {
    data: rows,
    colnames: ['interaction_id', 'agent', 'channel', 'queue'],
    coltypes: [
      GenericDataType.String,
      GenericDataType.String,
      GenericDataType.String,
      GenericDataType.String,
    ],
    rowcount: rows.length,
    sql_rowcount: sqlRowcount,
  },
  {
    data: counts.map(([queueName, agentName, count]) => ({
      queue: queueName,
      agent: agentName,
      'COUNT_DISTINCT(interaction_id)': count,
    })),
    colnames: ['queue', 'agent', 'COUNT_DISTINCT(interaction_id)'],
    coltypes: [
      GenericDataType.String,
      GenericDataType.String,
      GenericDataType.Numeric,
    ],
    rowcount: counts.length,
    sql_rowcount: counts.length,
  },
];
const TIER_1 = 'Support Tier 1';
const SALES = 'Sales Inbound';
const PRIYA = 'Priya Nair';

test('S4: the same agent under two queues gets only its own interactions; unrequested paths are ignored', () => {
  const entries = toEntries(
    fourLevelAnswer(
      [
        ...interactionsOf(TIER_1, PRIYA, 3),
        ...interactionsOf(SALES, PRIYA, 2),
        ...interactionsOf(TIER_1, 'Lena Vogel', 4),
      ],
      [
        [TIER_1, PRIYA, 3],
        [SALES, PRIYA, 2],
        [TIER_1, 'Lena Vogel', 4],
      ],
    ),
    {
      level: 2,
      paths: [
        [TIER_1, PRIYA],
        [SALES, PRIYA],
      ],
    },
    s4,
  );
  expect([...entries.keys()]).toEqual([
    JSON.stringify([TIER_1, PRIYA]),
    JSON.stringify([SALES, PRIYA]),
  ]);
  expect(
    entries.get(JSON.stringify([TIER_1, PRIYA]))?.rows.map(row => row.queue),
  ).toEqual([TIER_1, TIER_1, TIER_1]);
  expect(entries.get(JSON.stringify([SALES, PRIYA]))).toMatchObject({
    status: 'loaded',
    total: 2,
  });
  expect(
    entries
      .get(JSON.stringify([SALES, PRIYA]))
      ?.rows.map(row => row.interaction_id),
  ).toEqual([`${SALES}/${PRIYA}/0`, `${SALES}/${PRIYA}/1`]);
});

test('a missing path is empty below the counts limit and needs repair when unrelated counts fill the limit', () => {
  const paths = [
    [TIER_1, PRIYA],
    [SALES, PRIYA],
    [TIER_1, 'Lena Vogel'],
  ];
  const below = toEntries(
    fourLevelAnswer(interactionsOf(TIER_1, PRIYA, 2), [[TIER_1, PRIYA, 2]]),
    { level: 2, paths },
    s4,
  );
  expect(below.get(JSON.stringify([SALES, PRIYA]))?.status).toBe('empty');
  const atLimit = toEntries(
    fourLevelAnswer(
      [
        ...interactionsOf(TIER_1, PRIYA, 2),
        ...interactionsOf(TIER_1, 'Lena Vogel', 1),
      ],
      [
        [TIER_1, PRIYA, 2],
        [TIER_1, 'Lena Vogel', 1],
        [SALES, 'Lena Vogel', 7],
        [TIER_1, 'Noor Haddad', 7],
      ],
      10,
    ),
    { level: 2, paths },
    s4,
  );
  expect(atLimit.has(JSON.stringify([SALES, PRIYA]))).toBe(false);
  expect(atLimit.ambiguous).toEqual([[SALES, PRIYA]]);
});

test('a path with a positive count and missing rows needs repair', () => {
  const paths = [
    [TIER_1, PRIYA],
    [SALES, PRIYA],
    [TIER_1, 'Lena Vogel'],
  ];
  const entries = toEntries(
    Object.assign(
      fourLevelAnswer(
        [
          ...interactionsOf(TIER_1, PRIYA, 1),
          ...interactionsOf(TIER_1, 'Lena Vogel', 1),
        ],
        [
          [TIER_1, PRIYA, 1],
          [SALES, PRIYA, 1],
          [TIER_1, 'Lena Vogel', 1],
        ],
        2,
      ),
      { countsSeparate: true },
    ),
    { level: 2, paths },
    s4,
  );
  expect(entries.has(JSON.stringify([SALES, PRIYA]))).toBe(false);
  expect(entries.ambiguous).toEqual([[SALES, PRIYA]]);
  expect(entries.get(JSON.stringify([TIER_1, PRIYA]))?.status).toBe('loaded');
});

test('a single path with no children is empty: an empty answer is no cut', () => {
  const entries = toEntries(
    fourLevelAnswer([], [], 0),
    { level: 2, paths: [[SALES, PRIYA]] },
    s4,
  );
  expect(entries.get(JSON.stringify([SALES, PRIYA]))?.status).toBe('empty');
});

test('short rows across many paths need repair, never a false empty', () => {
  const paths = Array.from({ length: 1097 }, (_, index) => [
    ['Voice', 'Chat', 'Email'][index % 3],
    `s${index}`,
  ]);
  const levels: TreeLevel[] = [
    { ...queue, id_column: 'channel' },
    { ...agent, id_column: 'session_id', parent_column: 'channel' },
    {
      ...interaction,
      id_column: 'step_id',
      parent_column: 'session_id',
      children_shown: 100,
    },
  ];
  const cut = paths.slice(0, 15).flatMap(([channel, session]) =>
    Array.from({ length: 20 }, (_, index) => ({
      step_id: `${session}-${index}`,
      session_id: session,
      channel,
    })),
  );
  const counts = paths.map(([channel, session]) => ({
    channel,
    session_id: session,
    'COUNT_DISTINCT(step_id)': 20,
  }));
  const entries = toEntries(
    Object.assign(
      [
        {
          data: cut,
          colnames: ['step_id', 'session_id', 'channel'],
          coltypes: [],
          rowcount: cut.length,
          sql_rowcount: 300,
        },
        {
          data: counts,
          colnames: ['channel', 'session_id', 'COUNT_DISTINCT(step_id)'],
          coltypes: [],
          rowcount: 300,
          sql_rowcount: 300,
        },
      ],
      { countsSeparate: true },
    ),
    { level: 2, paths },
    levels,
  );
  const states = [...entries.values()].map(entry => entry.status);
  expect(states.filter(state => state === 'loaded')).toHaveLength(15);
  expect(states.filter(state => state === 'empty')).toHaveLength(0);
  expect(entries.ambiguous).toHaveLength(1082);
});

test.each([
  { groups: 49, total: 1476, sql: 1476, status: 'empty' },
  { groups: 84, total: 1353, sql: 1354, status: 'empty' },
  { groups: 0, total: 0, sql: 0, status: 'empty' },
  { groups: 2, total: 4, sql: 3, status: 'empty' },
])(
  'absent counts are empty when the counts query has room, independent of row SQL stats: %j',
  ({ groups, total, sql, status }) => {
    const result = answer(
      [],
      Array.from({ length: groups }, (_, index) => [
        `s${index}`,
        index ? 1 : total - groups + 1,
      ]),
    );
    result[0].sql_rowcount = sql;
    const entries = toEntries(
      result,
      {
        level: 1,
        paths: Array.from({ length: 100 }, (_, index) => [`s${index}`]).concat([
          ['missing'],
        ]),
      },
      levelsWith(100),
      true,
    );
    expect(entries.get(one('missing'))).toMatchObject({
      status,
      inRange: true,
    });
    expect(entries.ambiguous).toEqual([]);
  },
);

test('one-child row clipping schedules repair for every short path with a known count', () => {
  const paths = Array.from({ length: 1097 }, (_, index) => [`s${index}`]);
  const result = answer(
    paths.slice(0, 300).flatMap(([id]) => rowsOf(id, 1)),
    paths.map(([id]) => [id, 1]),
  );
  const entries = toEntries(
    Object.assign(result, { countsSeparate: true }),
    { level: 1, paths },
    levelsWith(100),
    true,
  );
  expect(entries.ambiguous).toEqual(paths.slice(300));
  expect([...entries.values()].every(entry => entry.status === 'loaded')).toBe(
    true,
  );
  expect(
    toEntries(
      answer([], []),
      { level: 1, paths: [['missing']] },
      levelsWith(100),
      true,
    ).get(one('missing')),
  ).toMatchObject({ status: 'empty', inRange: true });
});

test('Load more preserves inRange', () => {
  const entry = toEntries(
    answer(rowsOf('a', 1), [['a', 2]]),
    { level: 1, paths: [['a']] },
    levelsWith(1),
    true,
  ).get(one('a'))!;
  expect(appendMore(entry, answer(rowsOf('a', 1), []))).toMatchObject({
    inRange: true,
    status: 'loaded',
  });
});

test('an answer without sql_rowcount keeps a missing path empty, never cut or ambiguous', () => {
  [undefined, null].forEach(sqlRowcount => {
    const result = answer(rowsOf('S1', 1), [['S1', 1]]);
    result[0] = {
      ...result[0],
      sql_rowcount: sqlRowcount as unknown as number,
    };
    const entries = toEntries(
      result,
      { level: 1, paths: [['S1'], ['S2']] },
      levelsWith(100),
    );
    expect(entries.get(one('S1'))?.status).toBe('loaded');
    expect(entries.get(one('S2'))?.status).toBe('empty');
    expect(entries.ambiguous).toEqual([]);
  });
});
