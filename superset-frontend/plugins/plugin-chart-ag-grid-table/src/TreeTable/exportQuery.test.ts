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
import { QueryObject, VizType } from '@superset-ui/core';
import buildQuery from './buildQuery';
import { buildExportSpec, TreeTableExportSpec } from './exportQuery';
import { rowColumns } from './levelsToMirrors';
import { TreeTableFormData, TreeLevel, TreeTableOwnState } from './types';

const RANGE = '2026-11-08 : 2026-11-09';

const session: TreeLevel = {
  key: 'level-1',
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

const step: TreeLevel = {
  key: 'level-2',
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

const channelLevel: TreeLevel = {
  key: 'level-1',
  name: 'Channel',
  name_plural: 'Channels',
  id_column: 'channel',
  time_column: 'session_started_at',
  columns: [],
  detail_fields: [],
  sort: ['channel', true],
};

const s3: TreeLevel[] = [
  channelLevel,
  {
    ...session,
    key: 'level-2',
    parent_column: 'channel',
    columns: ['duration_ms', 'step_count', 'outcome'],
    children_shown: 100,
  },
  { ...step, key: 'level-3' },
];

const s4: TreeLevel[] = [
  {
    key: 'level-1',
    name: 'Queue',
    id_column: 'queue',
    time_column: 'start_local',
    columns: [],
    detail_fields: [],
    sort: ['queue', true],
  },
  {
    key: 'level-2',
    name: 'Agent',
    id_column: 'agent',
    parent_column: 'queue',
    columns: [],
    detail_fields: [],
    sort: ['agent', true],
  },
  {
    key: 'level-3',
    name: 'Interaction',
    id_column: 'interaction_id',
    parent_column: 'agent',
    columns: ['channel', 'segment_count'],
    detail_fields: ['source_phone', 'interaction_type'],
    sort: ['segment_count', false],
  },
  {
    key: 'level-4',
    name: 'Segment',
    id_column: 'segment_id',
    parent_column: 'interaction_id',
    time_column: 'segment_start',
    columns: [
      'segment_no',
      'segment_start',
      'segment_end',
      'segment_type',
      'subject',
    ],
    detail_fields: ['from_party', 'to_party', 'disposition'],
    sort: ['segment_no', false],
    apply_date_filter: true,
  },
];

const formData: TreeTableFormData = {
  datasource: '1__table',
  viz_type: VizType.TableAgGrid,
  query_mode: 'tree',
  row_limit: 1000,
  time_range: RANGE,
  extra_form_data: {
    filters: [{ col: 'channel', op: 'IN', val: ['Voice'] }],
  },
};

const search = {
  currentPage: 0,
  searchColumn: 'outcome',
  searchText: 'Comp',
};

function exportOf(
  levels: TreeLevel[],
  ownState: TreeTableOwnState = search,
  extra: Partial<TreeTableFormData> = {},
): TreeTableExportSpec {
  return buildQuery({ ...formData, levels, ...extra }, { ownState }).form_data
    ?.tree_export;
}

const stepOptions = (spec: TreeTableExportSpec) =>
  spec.query.post_processing[0].options;

test('Session export ignores old saved search: all columns, grouped rows, every page', () => {
  const spec = exportOf([session, step]);
  const { query } = spec;
  expect(query.columns).toEqual([
    ...rowColumns(session),
    'step_id',
    'item_desc',
    'item_label',
    'step',
    'loop',
    'step_duration_ms',
    'step_started_at',
    'step_ended_at',
    'result',
  ]);
  expect(query.columns).toHaveLength(20);
  expect(query.metrics).toEqual([]);
  expect(query).not.toHaveProperty('is_rowcount');
  expect(query.orderby).toEqual([
    ['duration_ms', false],
    ['session_id', true],
    ['channel', true],
    ['step_count', true],
    ['outcome', true],
    ['step', true],
    ['step_id', true],
  ]);
  expect(query.filters).toEqual([
    { col: 'channel', op: 'IN', val: ['Voice'], isExtra: true },
    { col: 'session_started_at', op: 'TEMPORAL_RANGE', val: RANGE },
  ]);
  expect(query.filters).toEqual(
    buildQuery({ ...formData, levels: [session, step] }, { ownState: search })
      .queries[0].filters,
  );
  expect(query.extras?.having).toBe('');
  expect(query.granularity).toBeUndefined();
  expect(query.time_range).toBe(RANGE);
  expect(query.row_limit).toBe(0);
  expect(query.row_offset).toBe(0);
  expect(query.post_processing).toHaveLength(1);
  expect(query.post_processing?.[0]?.operation).toBe('tree_rows');
  const options = stepOptions(spec);
  expect(options.levels).toHaveLength(2);
  expect(options.levels[0]).toEqual({
    id_column: 'session_id',
    columns: rowColumns(session),
  });
  expect(options.levels[1].columns[0]).toBe('step_id');
  expect(options.levels[1].columns).not.toContain('session_id');
  expect(options.levels[1]).not.toHaveProperty('time_column');
  expect(options.time_ranges).toEqual([RANGE]);
  expect(spec.child_filters).toEqual([]);
});

test('the header sort on screen is the first sort', () => {
  const { query } = exportOf([session, step], {
    sortBy: [{ id: 'channel', key: 'channel', desc: true }],
  });
  expect(query.orderby).toEqual([
    ['channel', false],
    ['session_id', true],
    ['duration_ms', true],
    ['step_count', true],
    ['outcome', true],
    ['step', true],
    ['step_id', true],
  ]);
});

test('a sort pair whose column is already listed is dropped', () => {
  const { query } = exportOf(
    [
      { ...session, sort: undefined },
      { ...step, sort: ['step_id', false] },
    ],
    {},
  );
  expect(query.orderby).toEqual([
    ['session_id', true],
    ['channel', true],
    ['duration_ms', true],
    ['step_count', true],
    ['outcome', true],
    ['step_id', false],
  ]);
});

test('export preserves page tie-breakers before sorting children', () => {
  const page: QueryObject = {
    orderby: [
      ['duration_ms', false],
      ['channel', true],
      ['session_id', false],
    ],
  };
  expect(buildExportSpec(page, page, [session, step])?.query.orderby).toEqual([
    ['duration_ms', false],
    ['channel', true],
    ['session_id', false],
    ['step', true],
    ['step_id', true],
  ]);
});

test('the step gets the child time column only with the option on and a range', () => {
  const on = exportOf([session, { ...step, apply_date_filter: true }]);
  expect(stepOptions(on).levels[1].time_column).toBe('step_started_at');
  expect(on.child_filters).toEqual([
    { col: 'step_started_at', op: 'TEMPORAL_RANGE', val: RANGE },
  ]);
  expect(on.query.filters).not.toContainEqual(on.child_filters[0]);

  const noFilter = exportOf(
    [session, { ...step, apply_date_filter: true }],
    search,
    { time_range: 'No filter' },
  );
  expect(stepOptions(noFilter).levels[1]).not.toHaveProperty('time_column');
  expect(stepOptions(noFilter).time_ranges).toEqual([]);
  expect(noFilter.child_filters).toEqual([]);
});

test('the parent row limit and page do not limit the export', () => {
  const { query } = exportOf([session, step], {
    ...search,
    currentPage: 4,
    pageSize: 10,
  });
  expect(query.row_limit).toBe(0);
  expect(query.row_offset).toBe(0);
});

test('a chart SQL HAVING is cleared and its WHERE is kept', () => {
  const { query } = exportOf([session, step], search, {
    adhoc_filters: [
      {
        expressionType: 'SQL',
        clause: 'WHERE',
        sqlExpression: 'duration_ms > 0',
      },
      {
        expressionType: 'SQL',
        clause: 'HAVING',
        sqlExpression: 'COUNT(*) > 1',
      },
    ],
  });
  expect(query.extras?.where).toBe('(duration_ms > 0)');
  expect(query.extras?.having).toBe('');
});

test('three levels (S3): one entry per level, each column owned once', () => {
  const spec = exportOf(
    [s3[0], s3[1], { ...s3[2], apply_date_filter: true }],
    {},
  );
  const options = stepOptions(spec);
  expect(options.levels.map(level => level.id_column)).toEqual([
    'channel',
    'session_id',
    'step_id',
  ]);
  const owned = options.levels.flatMap(level => level.columns);
  expect(owned).toEqual(spec.query.columns);
  expect(new Set(owned).size).toBe(owned.length);
  expect(options.levels[1]).not.toHaveProperty('time_column');
  expect(options.levels[2].time_column).toBe('step_started_at');
  expect(spec.query.orderby).toEqual([
    ['channel', true],
    ['duration_ms', false],
    ['session_id', true],
    ['step', true],
    ['step_id', true],
  ]);
});

test('four levels (S4): one entry per level, each column owned once', () => {
  const spec = exportOf(s4, {});
  const options = stepOptions(spec);
  expect(options.levels.map(level => level.id_column)).toEqual([
    'queue',
    'agent',
    'interaction_id',
    'segment_id',
  ]);
  const owned = options.levels.flatMap(level => level.columns);
  expect(owned).toEqual(spec.query.columns);
  expect(new Set(owned).size).toBe(owned.length);
  expect(options.levels[3].time_column).toBe('segment_start');
  expect(spec.child_filters).toEqual([
    { col: 'segment_start', op: 'TEMPORAL_RANGE', val: RANGE },
  ]);
});

test('a level whose time column is not exported filters children in SQL instead', () => {
  const legacy = {
    ...step,
    apply_date_filter: true,
    detail_fields: ['step_ended_at', 'result'],
  };
  const spec = exportOf([session, legacy]);
  expect(spec.query.columns).not.toContain('step_started_at');
  expect(stepOptions(spec).levels[1]).not.toHaveProperty('time_column');
  expect(spec.query.filters).toContainEqual({
    col: 'step_started_at',
    op: 'TEMPORAL_RANGE',
    val: RANGE,
  });
  expect(stepOptions(spec).time_ranges).toEqual([RANGE]);
});

test('no spec without a level 1 ID column', () => {
  const page = { columns: [], filters: [] } as QueryObject;
  expect(
    buildExportSpec(page, page, [{ ...session, id_column: '' }, step]),
  ).toBeUndefined();
  expect(buildExportSpec(page, page, [])).toBeUndefined();
});

test('a deeper level without an ID column ends the export levels', () => {
  const spec = exportOf([session, step, { ...step, id_column: '' }], {});
  expect(stepOptions(spec).levels).toHaveLength(2);
});

// Paired with tests/integration_tests/charts/data/tree_export_tests.py,
// which pastes the levels, BASE_QUERY, the three "No filter" export specs,
// the saved query context and withDay (as with_day).
const BASE_QUERY = {
  time_range: 'No filter',
  filters: [],
  extras: { having: '', where: '' },
  applied_time_extras: {},
  annotation_layers: [],
  series_limit: 0,
  group_others_when_limit_reached: false,
  order_desc: true,
  url_params: {},
  custom_params: {},
  custom_form_data: {},
};

const SESSION_COLUMNS = [
  'session_id',
  'channel',
  'duration_ms',
  'step_count',
  'outcome',
  'channel_key',
  'person_device_id',
  'web_chat_id',
  'display_name_override',
  'inbound_number',
  'inbound_domain',
];
const STEP_COLUMNS = [
  'step_id',
  'item_desc',
  'item_label',
  'step',
  'loop',
  'step_duration_ms',
  'step_started_at',
  'step_ended_at',
  'result',
];

const SESSION_EXPORT = {
  query: {
    ...BASE_QUERY,
    metrics: [],
    columns: [...SESSION_COLUMNS, ...STEP_COLUMNS],
    orderby: [
      ['duration_ms', false],
      ['session_id', true],
      ['channel', true],
      ['step_count', true],
      ['outcome', true],
      ['step', true],
      ['step_id', true],
    ],
    row_limit: 0,
    row_offset: 0,
    post_processing: [
      {
        operation: 'tree_rows',
        options: {
          levels: [
            { id_column: 'session_id', columns: SESSION_COLUMNS },
            { id_column: 'step_id', columns: STEP_COLUMNS },
          ],
          time_ranges: [],
        },
      },
    ],
  },
  child_filters: [],
};

const interaction: TreeLevel = {
  key: 'level-1',
  name: 'Interaction',
  name_plural: 'Interactions',
  id_column: 'interaction_id',
  time_column: 'start_local',
  columns: ['agent', 'queue', 'channel', 'segment_count'],
  detail_fields: ['start_local', 'source_phone', 'interaction_type'],
  sort: ['segment_count', false],
};

const segment: TreeLevel = {
  key: 'level-2',
  name: 'Segment',
  name_plural: 'Segments',
  id_column: 'segment_id',
  parent_column: 'interaction_id',
  time_column: 'segment_start',
  columns: [
    'segment_no',
    'segment_start',
    'segment_end',
    'segment_type',
    'subject',
  ],
  detail_fields: ['from_party', 'to_party', 'disposition'],
  sort: ['segment_no', false],
  children_shown: 100,
  apply_date_filter: true,
};

const SEGMENT_COLUMNS = [
  'segment_id',
  'segment_no',
  'segment_start',
  'segment_end',
  'segment_type',
  'subject',
  'from_party',
  'to_party',
  'disposition',
];

const CALL_TRACE_EXPORT = {
  query: {
    ...BASE_QUERY,
    metrics: [],
    columns: [
      'interaction_id',
      'agent',
      'queue',
      'channel',
      'segment_count',
      'start_local',
      'source_phone',
      'interaction_type',
      ...SEGMENT_COLUMNS,
    ],
    orderby: [
      ['segment_count', false],
      ['interaction_id', true],
      ['agent', true],
      ['queue', true],
      ['channel', true],
      ['segment_no', false],
      ['segment_id', true],
    ],
    row_limit: 0,
    row_offset: 0,
    post_processing: [
      {
        operation: 'tree_rows',
        options: {
          levels: [
            {
              id_column: 'interaction_id',
              columns: [
                'interaction_id',
                'agent',
                'queue',
                'channel',
                'segment_count',
                'start_local',
                'source_phone',
                'interaction_type',
              ],
            },
            { id_column: 'segment_id', columns: SEGMENT_COLUMNS },
          ],
          time_ranges: [],
        },
      },
    ],
  },
  child_filters: [],
};

const S4_EXPORT = {
  query: {
    ...BASE_QUERY,
    metrics: [],
    columns: [
      'queue',
      'agent',
      'interaction_id',
      'channel',
      'segment_count',
      'source_phone',
      'interaction_type',
      ...SEGMENT_COLUMNS,
    ],
    orderby: [
      ['queue', true],
      ['agent', true],
      ['segment_count', false],
      ['interaction_id', true],
      ['segment_no', false],
      ['segment_id', true],
    ],
    row_limit: 0,
    row_offset: 0,
    post_processing: [
      {
        operation: 'tree_rows',
        options: {
          levels: [
            { id_column: 'queue', columns: ['queue'] },
            { id_column: 'agent', columns: ['agent'] },
            {
              id_column: 'interaction_id',
              columns: [
                'interaction_id',
                'channel',
                'segment_count',
                'source_phone',
                'interaction_type',
              ],
            },
            { id_column: 'segment_id', columns: SEGMENT_COLUMNS },
          ],
          time_ranges: [],
        },
      },
    ],
  },
  child_filters: [],
};

function withDay(
  spec: typeof SESSION_EXPORT,
  day: string,
  dateColumn: string,
  childLevel?: number,
  childColumn?: string,
) {
  const copy = JSON.parse(JSON.stringify(spec));
  const range = { op: 'TEMPORAL_RANGE', val: day };
  copy.query.time_range = day;
  copy.query.filters = [{ col: dateColumn, ...range }];
  const { options } = copy.query.post_processing[0];
  options.time_ranges = [day];
  if (childLevel !== undefined) {
    options.levels[childLevel].time_column = childColumn;
    copy.child_filters = [{ col: childColumn, ...range }];
  }
  return copy;
}

const pasteForm = (levels: TreeLevel[], time_range: string) =>
  buildQuery({
    datasource: '1__table',
    viz_type: VizType.TableAgGrid,
    query_mode: 'tree',
    row_limit: 1000,
    levels,
    time_range,
    result_format: 'csv',
  }).form_data?.tree_export;

const DAY = '2026-11-11 : 2026-11-12';
const fourLevelsDateOff = [
  ...s4.slice(0, 3),
  { ...s4[3], apply_date_filter: false },
];

test('export specs pasted in tree_export_tests.py', () => {
  expect(pasteForm([session, step], 'No filter')).toEqual(SESSION_EXPORT);
  expect(pasteForm([interaction, segment], 'No filter')).toEqual(
    CALL_TRACE_EXPORT,
  );
  expect(pasteForm(s4, 'No filter')).toEqual(S4_EXPORT);
});

test('the day variants tree_export_tests.py builds with with_day', () => {
  const dated = { ...step, apply_date_filter: true };
  expect(pasteForm([session, step], DAY)).toEqual(
    withDay(SESSION_EXPORT, DAY, 'session_started_at'),
  );
  expect(pasteForm([session, dated], DAY)).toEqual(
    withDay(SESSION_EXPORT, DAY, 'session_started_at', 1, 'step_started_at'),
  );
  expect(
    pasteForm([interaction, { ...segment, apply_date_filter: false }], DAY),
  ).toEqual(withDay(CALL_TRACE_EXPORT, DAY, 'start_local'));
  expect(pasteForm([interaction, segment], DAY)).toEqual(
    withDay(CALL_TRACE_EXPORT, DAY, 'start_local', 1, 'segment_start'),
  );
  expect(pasteForm(fourLevelsDateOff, DAY)).toEqual(
    withDay(S4_EXPORT, DAY, 'start_local'),
  );
  expect(pasteForm(s4, DAY)).toEqual(
    withDay(S4_EXPORT, DAY, 'start_local', 3, 'segment_start'),
  );
});

test('saved query context pasted in tree_export_tests.py (reports)', () => {
  const savedFormData: TreeTableFormData = {
    datasource: '1__table',
    viz_type: VizType.TableAgGrid,
    query_mode: 'tree',
    tree_server_page_length: 50,
    row_limit: 1000,
    levels: [session, step],
    time_range: 'No filter',
    result_format: 'json',
    result_type: 'full',
  };
  const page = {
    ...BASE_QUERY,
    columns: SESSION_COLUMNS,
    metrics: [],
    orderby: [
      ['duration_ms', false],
      ['session_id', true],
      ['channel', true],
      ['step_count', true],
      ['outcome', true],
    ],
    row_limit: 50,
    row_offset: 0,
  };
  expect(buildQuery(savedFormData)).toEqual({
    datasource: { id: 1, type: 'table' },
    force: false,
    queries: [
      { ...page, granularity: undefined },
      {
        ...page,
        granularity: undefined,
        orderby: [],
        row_limit: 1000,
        post_processing: [],
        is_rowcount: true,
      },
    ],
    form_data: { ...savedFormData, tree_export: SESSION_EXPORT },
    result_format: 'json',
    result_type: 'full',
  });
});

// Paired with test_guest_csv_export in
// tests/integration_tests/charts/data/tree_table_guest_tests.py.
test('birth_names three-level CSV body for the guest HTTP test', () => {
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
  const guestExport = {
    query: {
      ...BASE_QUERY,
      metrics: [],
      columns: ['state', 'gender', 'name', 'num'],
      orderby: [
        ['state', true],
        ['gender', true],
        ['name', true],
      ],
      row_limit: 0,
      row_offset: 0,
      post_processing: [
        {
          operation: 'tree_rows',
          options: {
            levels: [
              { id_column: 'state', columns: ['state'] },
              { id_column: 'gender', columns: ['gender'] },
              { id_column: 'name', columns: ['name', 'num'] },
            ],
            time_ranges: [],
          },
        },
      ],
    },
    child_filters: [],
  };
  expect(pasteForm(levels, 'No filter')).toEqual(guestExport);
  expect(
    buildQuery({
      datasource: '1__table',
      viz_type: VizType.TableAgGrid,
      query_mode: 'tree',
      levels,
      time_range: 'No filter',
      result_format: 'csv',
      adhoc_filters: [
        { expressionType: 'SQL', clause: 'WHERE', sqlExpression: 'num > 0' },
      ],
    }).form_data?.tree_export,
  ).toEqual({
    ...guestExport,
    query: { ...guestExport.query, extras: { having: '', where: '(num > 0)' } },
  });
});
