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
import { VizType } from '@superset-ui/core';
import buildChildrenQuery from './buildChildrenQuery';
import {
  treeFormData,
  retainedTableControls,
} from '../../test/treeModeFixtures';
import { keyOf } from './childrenState';
import levelsToMirrors, { countMetric, rowColumns } from './levelsToMirrors';
import { TreeTableChildRequest, TreeTableFormData, TreeLevel } from './types';

test.each([
  ['%Y', '1980', undefined],
  ['%Y', '1980', 2],
  ['%Y-%m-%d', '1980-01-01', undefined],
  ['epoch_s', '315532800', undefined],
  ['epoch_ms', '315532800000', undefined],
  ['epoch_us', '315532800000000', undefined],
  ['epoch_us', '1700000000000007', undefined, '1700000000000.0068'],
])(
  'child filters use %s storage values (%s) at offset %s',
  (format, storedValue, offset, key = '315532800000') => {
    const formData: TreeTableFormData = {
      ...treeFormData,
      levels: [
        {
          key: 'platform',
          name: 'Platform',
          id_column: 'platform',
          columns: [],
          detail_fields: [],
        },
        {
          key: 'year',
          name: 'Year',
          id_column: 'year',
          parent_column: 'platform',
          columns: [],
          detail_fields: [],
        },
        {
          key: 'game',
          name: 'Game',
          id_column: 'name',
          parent_column: 'year',
          columns: [],
          detail_fields: [],
        },
      ],
    };
    const request = {
      level: 2,
      paths: [['2600', key]],
      linkDateFormats: new Map([['year', format]]),
      offset,
    };
    const { queries } = buildChildrenQuery(formData, {
      ownState: { treeTableChildren: request },
    });
    queries.forEach(query => {
      expect(query.filters).toEqual(
        expect.arrayContaining([
          { col: 'platform', op: 'IN', val: ['2600'] },
          { col: 'year', op: 'IN', val: [storedValue] },
        ]),
      );
    });
  },
);

const session: TreeLevel = {
  key: 'session',
  name: 'Session',
  name_plural: 'Sessions',
  id_column: 'session_id',
  time_column: 'session_started_at',
  columns: ['channel', 'duration_ms', 'step_count', 'outcome'],
  detail_fields: [
    'channel_key',
    'person_device_id',
    'web_chat_id',
    'display_name_override',
    'inbound_number',
    'inbound_domain',
  ],
  sort: ['duration_ms', false],
};

test.each([
  { level: 1, paths: [['P1']] },
  { level: 1, paths: [['P1'], ['P2']] },
  { level: 1, paths: [['P1']], offset: 100 },
  {
    level: 1,
    paths: [['P1'], ['P2']],
    sort: ['value', false] as [string, boolean],
  },
])(
  'direct children, counts, batches and Load more ignore retained Table V2 controls: %j',
  request => {
    const options = { ownState: { treeTableChildren: request } };
    expect(
      buildChildrenQuery({ ...treeFormData, ...retainedTableControls }, options)
        .queries,
    ).toEqual(buildChildrenQuery(treeFormData, options).queries);
    expect(
      buildChildrenQuery({ ...treeFormData, ...retainedTableControls }, options)
        .form_data,
    ).not.toHaveProperty('server_pagination');
    expect(
      buildChildrenQuery({ ...treeFormData, ...retainedTableControls }, options)
        .form_data,
    ).not.toHaveProperty('server_page_length');
  },
);

const step: TreeLevel = {
  key: 'step',
  name: 'Step',
  name_plural: 'Steps',
  id_column: 'step_id',
  parent_column: 'session_id',
  time_column: 'step_started_at',
  columns: ['item_desc', 'item_label', 'step', 'loop', 'step_duration_ms'],
  detail_fields: ['step_started_at', 'step_ended_at', 'result'],
  sort: ['step', true],
  children_shown: 100,
  apply_date_filter: false,
};

const formData: TreeTableFormData = {
  datasource: '1__table',
  viz_type: VizType.TableAgGrid,
  query_mode: 'tree',
  levels: [session, step],
  slice_id: 42,
  dashboardId: 7,
  time_range: 'Last week',
  granularity_sqla: 'step_started_at',
};

const build = (
  request: TreeTableChildRequest,
  extra: Partial<TreeTableFormData> = {},
) =>
  buildChildrenQuery(
    { ...formData, ...extra },
    { ownState: { treeTableChildren: request } },
  );

const filters = (parentIds: string[]) => [
  { col: 'session_started_at', op: 'TEMPORAL_RANGE', val: 'Last week' },
  { col: 'session_id', op: 'IN', val: parentIds },
  { col: 'step_id', op: 'IS NOT NULL' },
];

test('batch is a rows query and a counts query for the given parents', () => {
  const { queries, form_data } = build({
    level: 1,
    paths: [['s1'], ['s2'], ['s3']],
  });
  expect(queries).toHaveLength(2);
  const [rows, counts] = queries;
  expect(rows).toMatchObject({
    columns: rowColumns(step),
    metrics: [],
    orderby: [
      ['session_id', true],
      ['step', true],
      ['step_id', true],
    ],
    filters: filters(['s1', 's2', 's3']),
    row_limit: 100000,
    row_offset: 0,
    post_processing: [
      {
        operation: 'first_n_per_group',
        options: { groupby: ['session_id'], n: 100 },
      },
    ],
  });
  expect(counts).toMatchObject({
    columns: ['session_id'],
    metrics: [countMetric(step)],
    orderby: [],
    post_processing: [],
    row_limit: 3,
    row_offset: 0,
    filters: filters(['s1', 's2', 's3']),
  });
  for (const query of queries) {
    expect(query.granularity).toBeUndefined();
    expect(query.is_rowcount).toBeUndefined();
    expect(query.filters?.some(filter => filter.op === 'ILIKE')).toBe(false);
  }
  expect(form_data).toMatchObject({ slice_id: 42, dashboardId: 7 });
});

test('one path limits rows directly and retains the total count', () => {
  const { queries } = build(
    { level: 1, paths: [['s1']] },
    { levels: [session, { ...step, children_shown: 20 }] },
  );
  expect(queries).toHaveLength(2);
  expect(queries[0]).toMatchObject({
    row_limit: 20,
    row_offset: 0,
    post_processing: [],
  });
  expect(queries[1].metrics).toEqual([countMetric(step)]);
  expect(queries[1].row_limit).toBe(1);
});

test('no level sort orders by the parent then the child ID once', () => {
  const { queries } = build(
    { level: 1, paths: [['s1']] },
    { levels: [session, { ...step, sort: undefined }] },
  );
  expect(queries[0].orderby).toEqual([
    ['session_id', true],
    ['step_id', true],
  ]);
});

test('a requested sort outside the level columns falls back to the default sort', () => {
  expect(
    build({ level: 1, paths: [['s1']], sort: ['result', false] }).queries[0]
      .orderby,
  ).toEqual([
    ['session_id', true],
    ['step', true],
    ['step_id', true],
  ]);
});

test.each([
  { time_range: 'Last week' },
  {
    time_range: 'No filter',
    adhoc_filters: [
      {
        expressionType: 'SIMPLE' as const,
        clause: 'WHERE' as const,
        subject: 'step_started_at',
        operator: 'TEMPORAL_RANGE' as const,
        comparator: 'Last week',
      },
    ],
  },
  {
    time_range: 'No filter',
    extra_form_data: { time_range: 'Last week' },
  },
])('children keep the parent date range on level 1 time column: %s', extra => {
  for (const query of build(
    { level: 1, paths: [['s1']] },
    { granularity_sqla: undefined, ...extra },
  ).queries)
    expect(query.filters).toEqual(filters(['s1']));
});

test('No filter drops non-date filters and adds no date filter', () => {
  const { queries } = build(
    { level: 1, paths: [['s1']] },
    {
      time_range: 'No filter',
      granularity_sqla: undefined,
      adhoc_filters: [
        {
          expressionType: 'SIMPLE',
          clause: 'WHERE',
          subject: 'channel',
          operator: 'IN',
          comparator: ['Voice'],
        },
      ],
    },
  );
  for (const query of queries)
    expect(query.filters).toEqual([
      { col: 'session_id', op: 'IN', val: ['s1'] },
      { col: 'step_id', op: 'IS NOT NULL' },
    ]);
});

test('a big parent ID goes into the IN filter as its exact string', () => {
  const big = BigInt('9007199254740993');
  const { queries } = build({ level: 1, paths: [[keyOf(big)!], ['5']] });
  for (const query of queries)
    expect(query.filters).toContainEqual({
      col: 'session_id',
      op: 'IN',
      val: ['9007199254740993', '5'],
    });
});

// Paired with test_guest_children_batch in
// tests/integration_tests/charts/data/tree_table_guest_tests.py.
test('birth_names children batch for the guest HTTP test', () => {
  const { queries } = buildChildrenQuery(
    {
      datasource: '1__table',
      viz_type: VizType.TableAgGrid,
      query_mode: 'tree',
      time_range: 'No filter',
      levels: [
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
      ],
    },
    { ownState: { treeTableChildren: { level: 1, paths: [['CA'], ['NY']] } } },
  );
  expect(
    queries.map(
      ({
        columns,
        metrics,
        orderby,
        filters: queryFilters,
        row_limit,
        row_offset,
        post_processing,
      }) => ({
        columns,
        metrics,
        orderby,
        filters: queryFilters,
        row_limit,
        row_offset,
        post_processing,
      }),
    ),
  ).toEqual([
    {
      columns: ['name', 'state', 'num'],
      metrics: [],
      orderby: [
        ['state', true],
        ['name', true],
      ],
      filters: [
        { col: 'state', op: 'IN', val: ['CA', 'NY'] },
        { col: 'name', op: 'IS NOT NULL' },
      ],
      row_limit: 100000,
      row_offset: 0,
      post_processing: [
        {
          operation: 'first_n_per_group',
          options: { groupby: ['state'], n: 100 },
        },
      ],
    },
    {
      columns: ['state'],
      metrics: [
        {
          expressionType: 'SIMPLE',
          aggregate: 'COUNT_DISTINCT',
          column: { column_name: 'name' },
          label: 'COUNT_DISTINCT(name)',
        },
      ],
      orderby: [],
      filters: [
        { col: 'state', op: 'IN', val: ['CA', 'NY'] },
        { col: 'name', op: 'IS NOT NULL' },
      ],
      row_limit: 2,
      row_offset: 0,
      post_processing: [],
    },
  ]);
});

test('Load more is one rows query for one parent at the offset, with the batch order and date filter', () => {
  const [batch] = build({ level: 1, paths: [['s1'], ['s2']] }).queries;
  const { queries } = build({ level: 1, paths: [['s2']], offset: 100 });
  expect(queries).toHaveLength(1);
  expect(queries[0]).toMatchObject({
    columns: rowColumns(step),
    metrics: [],
    orderby: batch.orderby,
    filters: filters(['s2']),
    row_offset: 100,
    row_limit: 100,
    post_processing: [],
  });
  expect(queries[0].granularity).toBeUndefined();
  expect(queries[0].is_rowcount).toBeUndefined();
});

test('Load more takes its page size from shown per parent', () => {
  const { queries } = build(
    { level: 1, paths: [['s2']], offset: 20 },
    { levels: [session, { ...step, children_shown: 20 }] },
  );
  expect(queries[0]).toMatchObject({ row_offset: 20, row_limit: 20 });
});

test('Load more with a finite time range carries the level 1 range', () => {
  const { queries } = build(
    { level: 1, paths: [['s2']], offset: 100 },
    {
      time_range: '2026-11-07T00:00:00 : 2026-11-14T00:00:00',
      granularity_sqla: undefined,
    },
  );
  expect(queries[0].filters?.[0]).toEqual({
    col: 'session_started_at',
    op: 'TEMPORAL_RANGE',
    val: '2026-11-07T00:00:00 : 2026-11-14T00:00:00',
  });
});

test('a level 2 sort sits between the parent and the ID tie-break, in both queries kinds', () => {
  expect(
    build({ level: 1, paths: [['s1']], sort: ['item_label', false] }).queries[0]
      .orderby,
  ).toEqual([
    ['session_id', true],
    ['item_label', false],
    ['step_id', true],
  ]);
  expect(
    build({
      level: 1,
      paths: [['s1']],
      sort: ['item_label', false],
      offset: 100,
    }).queries[0].orderby,
  ).toEqual([
    ['session_id', true],
    ['item_label', false],
    ['step_id', true],
  ]);
});

test('a sort on the child ID gives no second ID pair', () => {
  expect(
    build({ level: 1, paths: [['s1']], sort: ['step_id', false] }).queries[0]
      .orderby,
  ).toEqual([
    ['session_id', true],
    ['step_id', false],
  ]);
});

test.each([
  ['a detail field', 'step_started_at'],
  ['a level 1 column', 'channel'],
  ['a removed column', 'item_code'],
])('a sort on %s gives the default sort', (_, column) => {
  expect(
    build({ level: 1, paths: [['s1']], sort: [column, true] }).queries[0]
      .orderby,
  ).toEqual([
    ['session_id', true],
    ['step', true],
    ['step_id', true],
  ]);
});

const birthNames: TreeTableFormData = {
  datasource: '1__table',
  viz_type: VizType.TableAgGrid,
  query_mode: 'tree',
  time_range: 'No filter',
  levels: [
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
  ],
};
const shape = (query: Record<string, unknown>) => ({
  columns: query.columns,
  metrics: query.metrics,
  orderby: query.orderby,
  filters: query.filters,
  row_limit: query.row_limit,
  row_offset: query.row_offset,
  post_processing: query.post_processing,
});

// Paired with test_guest_children_load_more_and_sorted_batch in
// tests/integration_tests/charts/data/tree_table_guest_tests.py.
test('birth_names Load more and descending batch for the guest HTTP test', () => {
  const more = buildChildrenQuery(birthNames, {
    ownState: {
      treeTableChildren: { level: 1, paths: [['CA']], offset: 100 },
    },
  }).queries.map(shape);
  expect(more).toEqual([
    {
      columns: ['name', 'state', 'num'],
      metrics: [],
      orderby: [
        ['state', true],
        ['name', true],
      ],
      filters: [
        { col: 'state', op: 'IN', val: ['CA'] },
        { col: 'name', op: 'IS NOT NULL' },
      ],
      row_limit: 100,
      row_offset: 100,
      post_processing: [],
    },
  ]);
  const sorted = buildChildrenQuery(birthNames, {
    ownState: {
      treeTableChildren: {
        level: 1,
        paths: [['CA'], ['NY']],
        sort: ['num', false],
      },
    },
  }).queries.map(shape);
  expect(sorted[0].orderby).toEqual([
    ['state', true],
    ['num', false],
    ['name', true],
  ]);
  expect(sorted[1].orderby).toEqual([]);
});

// The three- and four-level set-ups; the same literals are in
// buildChildrenQueryGuard.test.ts, useChildren.test.ts and TreeTableChart.test.tsx.
const threeLevelChannel: TreeLevel = {
  key: 'channel',
  name: 'Channel',
  name_plural: 'Channels',
  id_column: 'channel',
  time_column: 'session_started_at',
  columns: [],
  detail_fields: [],
  sort: ['channel', true],
};
const threeLevelSession: TreeLevel = {
  key: 'session',
  name: 'Session',
  name_plural: 'Sessions',
  id_column: 'session_id',
  parent_column: 'channel',
  columns: ['duration_ms', 'step_count', 'outcome'],
  detail_fields: ['channel_key', 'inbound_number'],
  sort: ['duration_ms', false],
  children_shown: 100,
};
const threeLevelStep: TreeLevel = {
  key: 'step',
  name: 'Step',
  name_plural: 'Steps',
  id_column: 'step_id',
  parent_column: 'session_id',
  columns: ['item_desc', 'item_label', 'step', 'loop', 'step_duration_ms'],
  detail_fields: ['step_started_at', 'step_ended_at', 'result'],
  sort: ['step', true],
};
const fourLevels: TreeLevel[] = [
  {
    key: 'queue',
    name: 'Queue',
    name_plural: 'Queues',
    id_column: 'queue',
    time_column: 'start_local',
    columns: [],
    detail_fields: [],
    sort: ['queue', true],
  },
  {
    key: 'agent',
    name: 'Agent',
    name_plural: 'Agents',
    id_column: 'agent',
    parent_column: 'queue',
    columns: [],
    detail_fields: [],
    sort: ['agent', true],
  },
  {
    key: 'interaction',
    name: 'Interaction',
    name_plural: 'Interactions',
    id_column: 'interaction_id',
    parent_column: 'agent',
    columns: ['channel', 'segment_count'],
    detail_fields: ['source_phone', 'interaction_type'],
    sort: ['segment_count', false],
  },
  {
    key: 'segment',
    name: 'Segment',
    name_plural: 'Segments',
    id_column: 'segment_id',
    parent_column: 'interaction_id',
    columns: [
      'segment_no',
      'segment_start',
      'segment_end',
      'segment_type',
      'subject',
    ],
    detail_fields: ['from_party', 'to_party', 'disposition'],
    sort: ['segment_no', false],
  },
];
const threeLevelForm: TreeTableFormData = {
  datasource: '1__table',
  viz_type: VizType.TableAgGrid,
  query_mode: 'tree',
  levels: [threeLevelChannel, threeLevelSession, threeLevelStep],
  time_range: 'Last week',
};
const threeLevelBuild = (request: TreeTableChildRequest) =>
  buildChildrenQuery(threeLevelForm, {
    ownState: { treeTableChildren: request },
  });
const threeLevelDate = {
  col: 'session_started_at',
  op: 'TEMPORAL_RANGE',
  val: 'Last week',
};

test('S3 level-3 batch matches each step to its channel and session', () => {
  const { queries } = threeLevelBuild({
    level: 2,
    paths: [
      ['Voice', 's1'],
      ['Voice', 's2'],
      ['Chat', 's3'],
    ],
  });
  expect(queries).toHaveLength(2);
  const [rows, counts] = queries;
  const filters = [
    threeLevelDate,
    { col: 'channel', op: 'IN', val: ['Voice', 'Chat'] },
    { col: 'session_id', op: 'IN', val: ['s1', 's2', 's3'] },
    { col: 'step_id', op: 'IS NOT NULL' },
  ];
  expect(rows).toMatchObject({
    columns: [...rowColumns(threeLevelStep), 'channel'],
    metrics: [],
    orderby: [
      ['channel', true],
      ['session_id', true],
      ['step', true],
      ['step_id', true],
    ],
    filters,
    post_processing: [
      {
        operation: 'first_n_per_group',
        options: { groupby: ['channel', 'session_id'], n: 100 },
      },
    ],
    row_limit: 100000,
    row_offset: 0,
  });
  expect(counts).toMatchObject({
    columns: ['channel', 'session_id'],
    metrics: [countMetric(threeLevelStep)],
    orderby: [],
    post_processing: [],
    filters,
    row_limit: 6,
  });
});

test('S3 level-2 batch keeps the level-2 shape with the distinct count', () => {
  const [rows, counts] = threeLevelBuild({
    level: 1,
    paths: [['Voice'], ['Chat']],
  }).queries;
  expect(rows).toMatchObject({
    columns: rowColumns(threeLevelSession),
    orderby: [
      ['channel', true],
      ['duration_ms', false],
      ['session_id', true],
    ],
    filters: [
      threeLevelDate,
      { col: 'channel', op: 'IN', val: ['Voice', 'Chat'] },
      { col: 'session_id', op: 'IS NOT NULL' },
    ],
    post_processing: [
      {
        operation: 'first_n_per_group',
        options: { groupby: ['channel'], n: 100 },
      },
    ],
  });
  expect(counts).toMatchObject({
    columns: ['channel'],
    metrics: [
      {
        aggregate: 'COUNT_DISTINCT',
        label: 'COUNT_DISTINCT(session_id)',
      },
    ],
    row_limit: 2,
  });
});

test('S3 Load more on one level-3 path is one rows query with both link filters', () => {
  const { queries } = threeLevelBuild({
    level: 2,
    paths: [['Voice', 's1']],
    offset: 100,
  });
  expect(queries).toHaveLength(1);
  expect(queries[0]).toMatchObject({
    filters: [
      threeLevelDate,
      { col: 'channel', op: 'IN', val: ['Voice'] },
      { col: 'session_id', op: 'IN', val: ['s1'] },
      { col: 'step_id', op: 'IS NOT NULL' },
    ],
    row_offset: 100,
    row_limit: 100,
    post_processing: [],
  });
});

test('S4 level-4 batch links queue, agent and interaction; counts limit is the product of distinct values', () => {
  const [rows, counts] = buildChildrenQuery(
    { ...threeLevelForm, levels: fourLevels },
    {
      ownState: {
        treeTableChildren: {
          level: 3,
          paths: [
            ['Support Tier 1', 'Priya Nair', 'i1'],
            ['Sales Inbound', 'Priya Nair', 'i2'],
            ['Sales Inbound', 'Lena Vogel', 'i3'],
          ],
        },
      },
    },
  ).queries;
  expect(rows.post_processing).toEqual([
    {
      operation: 'first_n_per_group',
      options: { groupby: ['queue', 'agent', 'interaction_id'], n: 100 },
    },
  ]);
  expect(rows.orderby).toEqual([
    ['queue', true],
    ['agent', true],
    ['interaction_id', true],
    ['segment_no', false],
    ['segment_id', true],
  ]);
  expect(rows.columns).toEqual([
    ...rowColumns(fourLevels[3]),
    'queue',
    'agent',
  ]);
  expect(counts.columns).toEqual(['queue', 'agent', 'interaction_id']);
  expect(counts.row_limit).toBe(2 * 2 * 3);
});

test('a finite range puts the level-1 time column range on level-3 and level-4 requests', () => {
  const time_range = '2026-11-01T00:00:00 : 2026-11-15T00:00:00';
  const s3 = buildChildrenQuery(
    { ...threeLevelForm, time_range },
    {
      ownState: {
        treeTableChildren: { level: 2, paths: [['Voice', 's1']] },
      },
    },
  ).queries;
  const s4 = buildChildrenQuery(
    { ...threeLevelForm, levels: fourLevels, time_range },
    {
      ownState: {
        treeTableChildren: {
          level: 3,
          paths: [['Support Tier 1', 'Priya Nair', 'i1']],
          offset: 100,
        },
      },
    },
  ).queries;
  s3.forEach(query =>
    expect(query.filters?.[0]).toEqual({
      col: 'session_started_at',
      op: 'TEMPORAL_RANGE',
      val: time_range,
    }),
  );
  s4.forEach(query =>
    expect(query.filters?.[0]).toEqual({
      col: 'start_local',
      op: 'TEMPORAL_RANGE',
      val: time_range,
    }),
  );
});

test('birth_names three-level batch and mirrors for the guest HTTP test', () => {
  // Pasted into tree_table_guest_tests.py (LEVELS_3, MIRRORS_3 and
  // test_guest_three_level_batch).
  const levels: TreeLevel[] = [
    {
      key: 'level-1',
      name: 'State',
      id_column: 'state',
      time_column: 'ds',
      columns: [],
      detail_fields: [],
    },
    {
      key: 'level-2',
      name: 'Gender',
      id_column: 'gender',
      parent_column: 'state',
      columns: [],
      detail_fields: [],
    },
    {
      key: 'level-3',
      name: 'Name',
      id_column: 'name',
      parent_column: 'gender',
      columns: ['num'],
      detail_fields: [],
      children_shown: 100,
    },
  ];
  expect(levelsToMirrors(levels)).toEqual({
    tree_columns: ['state', 'gender', 'name', 'num'],
    tree_metrics: [countMetric(levels[1]), countMetric(levels[2])],
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
  const { queries } = buildChildrenQuery(
    {
      datasource: '1__table',
      viz_type: VizType.TableAgGrid,
      query_mode: 'tree',
      time_range: 'No filter',
      levels,
    },
    {
      ownState: {
        treeTableChildren: {
          level: 2,
          paths: [
            ['CA', 'boy'],
            ['NY', 'girl'],
          ],
        },
      },
    },
  );
  const filters = [
    { col: 'state', op: 'IN', val: ['CA', 'NY'] },
    { col: 'gender', op: 'IN', val: ['boy', 'girl'] },
    { col: 'name', op: 'IS NOT NULL' },
  ];
  expect(
    queries.map(
      ({
        columns,
        metrics,
        orderby,
        filters: queryFilters,
        row_limit,
        row_offset,
        post_processing,
      }) => ({
        columns,
        metrics,
        orderby,
        filters: queryFilters,
        row_limit,
        row_offset,
        post_processing,
      }),
    ),
  ).toEqual([
    {
      columns: ['name', 'gender', 'num', 'state'],
      metrics: [],
      orderby: [
        ['state', true],
        ['gender', true],
        ['name', true],
      ],
      filters,
      row_limit: 100000,
      row_offset: 0,
      post_processing: [
        {
          operation: 'first_n_per_group',
          options: { groupby: ['state', 'gender'], n: 100 },
        },
      ],
    },
    {
      columns: ['state', 'gender'],
      metrics: [
        {
          expressionType: 'SIMPLE',
          aggregate: 'COUNT_DISTINCT',
          column: { column_name: 'name' },
          label: 'COUNT_DISTINCT(name)',
        },
      ],
      orderby: [],
      filters,
      row_limit: 4,
      row_offset: 0,
      post_processing: [],
    },
  ]);
});

test.each([
  { level: 1, paths: [['s1'], ['s2']] },
  { level: 1, paths: [['s1']] },
  { level: 1, paths: [['s1']], offset: 100 },
  {
    level: 1,
    paths: [['s1'], ['s2']],
    sort: ['step', false] as [string, boolean],
  },
])(
  'all child query shapes carry both ranges and clear non-date filters: %j',
  request => {
    const original = build(request).queries;
    const result = build(request, {
      levels: [session, { ...step, apply_date_filter: true }],
      extra_form_data: {
        filters: [{ col: 'result', op: 'IN', val: ['error'] }],
      },
    }).queries;
    result.forEach((query, index) => {
      expect(query.filters).toEqual([
        { col: 'session_started_at', op: 'TEMPORAL_RANGE', val: 'Last week' },
        { col: 'step_started_at', op: 'TEMPORAL_RANGE', val: 'Last week' },
        {
          col: 'session_id',
          op: 'IN',
          val: request.paths.map(path => path[0]),
        },
        { col: 'step_id', op: 'IS NOT NULL' },
      ]);
      expect(query.extras).toMatchObject({ where: '', having: '' });
      expect(query.granularity).toBeUndefined();
      expect(query.columns).toEqual(original[index].columns);
      expect(query.metrics).toEqual(original[index].metrics);
      expect(query.orderby).toEqual(original[index].orderby);
    });
  },
);

// Paired literal: test_guest_children_keep_rls_with_cleared_sql_filters in
// tests/integration_tests/charts/data/tree_table_guest_tests.py.
test('birth_names date-filtered guest children with cleared SQL', () => {
  const { queries } = buildChildrenQuery(
    {
      datasource: '1__table',
      viz_type: VizType.TableAgGrid,
      query_mode: 'tree',
      time_range: '1900-01-01 : 2100-01-01',
      adhoc_filters: [
        { expressionType: 'SQL', clause: 'WHERE', sqlExpression: 'num > 0' },
        {
          expressionType: 'SIMPLE',
          clause: 'WHERE',
          subject: 'name',
          operator: 'IN',
          comparator: ['Aaron'],
          isExtra: true,
        },
      ],
      levels: [
        {
          key: 'level-1',
          name: 'State',
          id_column: 'state',
          time_column: 'ds',
          columns: [],
          detail_fields: [],
        },
        {
          key: 'level-2',
          name: 'Gender',
          id_column: 'gender',
          parent_column: 'state',
          columns: ['num'],
          detail_fields: [],
          time_column: 'ds',
          apply_date_filter: true,
        },
        {
          key: 'level-3',
          name: 'Name',
          id_column: 'name',
          parent_column: 'gender',
          columns: ['num'],
          detail_fields: [],
          children_shown: 100,
        },
      ],
    },
    { ownState: { treeTableChildren: { level: 1, paths: [['CA'], ['NY']] } } },
  );
  // These query fields are pasted into the paired Python test.
  const common = {
    filters: [
      { col: 'ds', op: 'TEMPORAL_RANGE', val: '1900-01-01 : 2100-01-01' },
      { col: 'state', op: 'IN', val: ['CA', 'NY'] },
      { col: 'gender', op: 'IS NOT NULL' },
    ],
    time_range: '1900-01-01 : 2100-01-01',
    extras: { where: '', having: '' },
    row_offset: 0,
  };
  expect(
    queries.map(
      ({
        filters,
        time_range,
        extras,
        row_offset,
        columns,
        metrics,
        orderby,
        row_limit,
        post_processing,
      }) => ({
        filters,
        time_range,
        extras: { where: extras?.where, having: extras?.having },
        row_offset,
        columns,
        metrics,
        orderby,
        row_limit,
        post_processing,
      }),
    ),
  ).toEqual([
    {
      ...common,
      columns: ['gender', 'state', 'num'],
      metrics: [],
      orderby: [
        ['state', true],
        ['gender', true],
      ],
      row_limit: 100000,
      post_processing: [
        {
          operation: 'first_n_per_group',
          options: { groupby: ['state'], n: 100 },
        },
      ],
    },
    {
      ...common,
      columns: ['state'],
      metrics: [
        {
          expressionType: 'SIMPLE',
          aggregate: 'COUNT_DISTINCT',
          column: { column_name: 'gender' },
          label: 'COUNT_DISTINCT(gender)',
        },
      ],
      orderby: [],
      row_limit: 2,
      post_processing: [],
    },
  ]);
});
