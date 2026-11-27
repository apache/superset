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
import { createElement } from 'react';
import { render } from 'spec/helpers/testing-library';
import {
  DataMask,
  NO_TIME_RANGE,
  QueryObjectFilterClause,
  VizType,
} from '@superset-ui/core';
import TimeFilterPlugin from 'src/filters/components/Time/TimeFilterPlugin';
import { getExtraFormData } from 'src/dashboard/components/nativeFilters/utils';
import buildQuery from './buildQuery';
import buildChildrenQuery from './buildChildrenQuery';
import { TreeTableExportSpec } from './exportQuery';
import { TreeTableFormData, TreeLevel } from './types';

const session: TreeLevel = {
  key: 'session',
  name: 'Session',
  name_plural: 'Sessions',
  id_column: 'session_id',
  time_column: 'session_started_at',
  columns: ['channel', 'session_id', 'duration_ms'],
  detail_fields: ['inbound_number', 'channel'],
  sort: ['duration_ms', false],
};

const step: TreeLevel = {
  key: 'step',
  name: 'Step',
  id_column: 'step_id',
  parent_column: 'session_id',
  columns: ['step_name'],
  detail_fields: ['step_detail'],
  sort: ['step_id', true],
};

const baseFormData: TreeTableFormData = {
  datasource: '1__table',
  viz_type: VizType.TableAgGrid,
  query_mode: 'tree',
};

test('level 1 sets columns, metrics and orderby, ignoring form data values', () => {
  const { queries } = buildQuery({
    ...baseFormData,
    levels: [session, step],
    columns: ['other_column'],
    metrics: [
      {
        expressionType: 'SQL',
        sqlExpression: 'COUNT(*)',
        label: 'count',
      },
    ],
    orderby: [['other_column', false]],
  });
  expect(queries).toHaveLength(2);
  expect(queries[0].columns).toEqual([
    'session_id',
    'channel',
    'duration_ms',
    'inbound_number',
  ]);
  expect(queries[0].metrics).toEqual([]);
  expect(queries[0].orderby).toEqual([
    ['duration_ms', false],
    ['session_id', true],
    ['channel', true],
  ]);
});

test('no levels gives an empty query', () => {
  const { queries } = buildQuery(baseFormData);
  expect(queries).toHaveLength(1);
  expect(queries[0].columns).toEqual([]);
  expect(queries[0].metrics).toEqual([]);
  expect(queries[0].orderby).toEqual([]);
});

test('level 1 without an ID column gives an empty query', () => {
  const { queries } = buildQuery({
    ...baseFormData,
    levels: [{ ...session, id_column: '' }],
  });
  expect(queries[0].columns).toEqual([]);
  expect(queries[0].metrics).toEqual([]);
  expect(queries[0].orderby).toEqual([]);
});

test('no sort orders by the ID column ascending', () => {
  const { queries } = buildQuery({
    ...baseFormData,
    levels: [{ ...session, sort: undefined }],
  });
  expect(queries[0].orderby).toEqual([
    ['session_id', true],
    ['channel', true],
    ['duration_ms', true],
  ]);
});

test('never sets raw query mode', () => {
  const { queries, form_data } = buildQuery({
    ...baseFormData,
    levels: [session],
  });
  expect(form_data?.query_mode).toBe('tree');
  expect(queries[0].is_rowcount).toBeFalsy();
});

test('returns a capped grouped page and matching count without order or post-processing', () => {
  const { queries } = buildQuery(
    {
      ...baseFormData,
      levels: [session],
      row_limit: 120,
      tree_server_page_length: 50,
    },
    { ownState: { currentPage: 3 } },
  );
  expect(queries[0]).toMatchObject({
    row_offset: 100,
    row_limit: 20,
    metrics: [],
    orderby: [
      ['duration_ms', false],
      ['session_id', true],
      ['channel', true],
    ],
  });
  expect(queries[1]).toMatchObject({
    columns: queries[0].columns,
    metrics: [],
    orderby: [],
    row_offset: 0,
    row_limit: 120,
    post_processing: [],
    is_rowcount: true,
  });
});
test.each(['channel', 'duration_ms', 'session_id'] as const)(
  'accepts only a parent header sort: %s',
  id => {
    const { queries } = buildQuery(
      { ...baseFormData, levels: [session] },
      { ownState: { sortBy: [{ id, key: id, desc: true }] } },
    );
    expect(queries[0].orderby).toEqual(
      {
        channel: [
          ['channel', false],
          ['session_id', true],
          ['duration_ms', true],
        ],
        duration_ms: [
          ['duration_ms', false],
          ['session_id', true],
          ['channel', true],
        ],
        session_id: [
          ['session_id', false],
          ['channel', true],
          ['duration_ms', true],
        ],
      }[id],
    );
    expect(queries[1].orderby).toEqual([]);
  },
);
test.each(['inbound_number', 'step_name', 'removed'])(
  'rejects non-parent sort %s',
  id => {
    expect(
      buildQuery(
        { ...baseFormData, levels: [session, step] },
        { ownState: { sortBy: [{ id, key: id, desc: false }] } },
      ).queries[0].orderby,
    ).toEqual([
      ['duration_ms', false],
      ['session_id', true],
      ['channel', true],
    ]);
  },
);
test.each(['channel', 'session_id', 'removed', undefined])(
  'old saved search is ignored for every column: %s',
  searchColumn => {
    const legacy = { currentPage: 0, searchColumn, searchText: 'ab' };
    const { queries } = buildQuery(
      { ...baseFormData, levels: [session], include_search: true },
      { ownState: legacy },
    );
    for (const query of queries) {
      expect(query.filters).toEqual([]);
    }
  },
);
test.each([
  { time_range: 'Last week', granularity_sqla: 'step_started_at' },
  { time_range: 'Last week' },
  {
    filters: [
      {
        col: 'step_started_at',
        op: 'TEMPORAL_RANGE' as const,
        val: 'Last week',
      },
    ],
  },
])('binds parent dates in both queries: %s', extra => {
  const { queries } = buildQuery({
    ...baseFormData,
    levels: [session],
    ...extra,
    ...(extra.filters
      ? {
          adhoc_filters: extra.filters.map(filter => ({
            expressionType: 'SIMPLE' as const,
            clause: 'WHERE' as const,
            subject: filter.col,
            operator: filter.op,
            comparator: filter.val,
          })),
        }
      : {}),
  });
  for (const query of queries) {
    expect(query.granularity).toBeUndefined();
    expect(query.filters).toEqual([
      { col: 'session_started_at', op: 'TEMPORAL_RANGE', val: 'Last week' },
    ]);
  }
});
const dated = (subject: string, comparator: string, isExtra = false) => ({
  expressionType: 'SIMPLE' as const,
  clause: 'WHERE' as const,
  subject,
  operator: 'TEMPORAL_RANGE' as const,
  comparator,
  ...(isExtra ? { isExtra } : {}),
});
const stepWithDate: TreeLevel = {
  ...step,
  time_column: 'step_started_at',
  apply_date_filter: true,
  columns: ['step_name', 'step_started_at'],
};
const dateQueries = (form: Partial<TreeTableFormData>) => {
  const formData = {
    ...baseFormData,
    levels: [session, stepWithDate],
    ...form,
  };
  const context = buildQuery(formData);
  const children = buildChildrenQuery(formData, {
    ownState: { treeTableChildren: { level: 1, paths: [['s1']] } },
  });
  const ranges = (filters: QueryObjectFilterClause[] = []) =>
    filters.filter(filter => filter.op === 'TEMPORAL_RANGE') as {
      col: string;
      op: string;
      val: unknown;
    }[];
  const exportSpec: TreeTableExportSpec = context.form_data?.tree_export;
  const [step] = exportSpec.query.post_processing ?? [];
  const { options } = step as {
    options: { time_ranges: string[]; levels: { time_column?: string }[] };
  };
  return {
    parents: ranges(context.queries[0].filters),
    children: ranges(children.queries[0].filters),
    exported: ranges(exportSpec.query.filters),
    timeRanges: options.time_ranges,
    childTime: options.levels[1].time_column,
  };
};

test('the chart range moves to level 1; a hand-made range on another column keeps its column on parents, children and export', () => {
  const own = {
    col: 'session_started_at',
    op: 'TEMPORAL_RANGE',
    val: 'Last week',
  };
  const handMade = {
    col: 'other_date',
    op: 'TEMPORAL_RANGE',
    val: '2026-01-01 : 2026-02-01',
  };
  expect(
    dateQueries({
      adhoc_filters: [
        dated('created_at', 'Last week'),
        dated('other_date', '2026-01-01 : 2026-02-01'),
      ],
    }),
  ).toEqual({
    parents: [own, handMade],
    children: [own, handMade, { ...own, col: 'step_started_at' }],
    exported: [own, handMade],
    timeRanges: ['Last week'],
    childTime: 'step_started_at',
  });
});

test('a dashboard time range and a dashboard date range move to level 1; the chart range still moves', () => {
  expect(
    dateQueries({ extra_form_data: { time_range: 'Last month' } }).parents,
  ).toEqual([
    { col: 'session_started_at', op: 'TEMPORAL_RANGE', val: 'Last month' },
  ]);
  const result = dateQueries({
    adhoc_filters: [
      dated('created_at', 'Last week'),
      dated('dashboard_date', 'Last day', true),
    ],
  });
  expect(result.parents.map(filter => [filter.col, filter.val])).toEqual([
    ['session_started_at', 'Last week'],
    ['session_started_at', 'Last day'],
  ]);
  expect(result.timeRanges).toEqual(['Last week', 'Last day']);
});

test('a hand-made range on the legacy granularity column moves; one on another column does not bound children', () => {
  const result = dateQueries({
    granularity_sqla: 'legacy_time',
    adhoc_filters: [
      dated('created_at', 'Last week'),
      dated('legacy_time', 'Last day'),
      dated('other_date', 'Last year'),
    ],
  });
  expect(result.parents.map(filter => [filter.col, filter.val])).toEqual([
    ['session_started_at', 'Last week'],
    ['session_started_at', 'Last day'],
    ['other_date', 'Last year'],
  ]);
  expect(
    result.children
      .filter(filter => filter.col === 'step_started_at')
      .map(filter => filter.val),
  ).toEqual(['Last week', 'Last day']);
  expect(result.timeRanges).toEqual(['Last week', 'Last day']);
});

test.each([
  ['a finite dashboard range', '2026-03-01 : 2026-04-01', 'step_started_at'],
  ['no dashboard range', undefined, 'step_started_at'],
] as const)(
  '%s against the chart range and a hand-made range on parents, children and export',
  (_, dashboard, childTime) => {
    const range = dashboard ?? '2026-01-01 : 2026-02-01';
    const on = (col: string, val: string) => ({
      col,
      op: 'TEMPORAL_RANGE',
      val,
    });
    const sorted = (filters: { col: string; val: unknown }[]) =>
      filters.map(({ col, val }) => `${col}=${val}`).sort();
    const result = dateQueries({
      adhoc_filters: [
        dated('source_date', '2026-01-01 : 2026-02-01'),
        dated('other_date', 'Last year'),
      ],
      ...(dashboard === undefined
        ? {}
        : { extra_form_data: { time_range: dashboard } }),
    });
    const parents = [
      on('session_started_at', range),
      on('other_date', 'Last year'),
    ];
    expect(sorted(result.parents)).toEqual(sorted(parents));
    expect(sorted(result.exported)).toEqual(sorted(parents));
    expect(sorted(result.children)).toEqual(
      sorted([...parents, on('step_started_at', range)]),
    );
    expect(result.timeRanges).toEqual([range]);
    expect(result.childTime).toBe(childTime);
  },
);

test.each([undefined, NO_TIME_RANGE])(
  'a cleared native time filter keeps the saved chart range on parents, children and export: %s',
  value => {
    const setDataMask = jest.fn<void, [DataMask]>();
    render(
      createElement(TimeFilterPlugin, {
        behaviors: [],
        data: [],
        height: 100,
        width: 200,
        formData: {
          datasource: '1__table',
          viz_type: 'filter_time',
          height: 100,
          width: 200,
          inView: false,
        },
        filterState: { value },
        inputRef: { current: null },
        setDataMask,
        setFilterActive: jest.fn(),
        setFocusedFilter: jest.fn(),
        unsetFocusedFilter: jest.fn(),
        setHoveredFilter: jest.fn(),
        unsetHoveredFilter: jest.fn(),
      }),
    );
    const mask = setDataMask.mock.calls[0][0];
    expect(mask.extraFormData).toEqual({});
    const extraFormData = getExtraFormData(
      { 'native-time': { id: 'native-time', ...mask } },
      ['native-time'],
    );
    expect(extraFormData).not.toHaveProperty('time_range');
    const result = dateQueries({
      adhoc_filters: [dated('source_date', 'Last week')],
      extra_form_data: extraFormData,
    });
    const parentRange = {
      col: 'session_started_at',
      op: 'TEMPORAL_RANGE',
      val: 'Last week',
    };
    const childRange = { ...parentRange, col: 'step_started_at' };
    expect(result.parents).toEqual([parentRange]);
    expect(result.children).toHaveLength(2);
    expect(result.children).toEqual(
      expect.arrayContaining([parentRange, childRange]),
    );
    expect(result.exported).toEqual([parentRange]);
    expect(result.timeRanges).toEqual(['Last week']);
    expect(result.childTime).toBe('step_started_at');
  },
);

test('an explicit No filter chart range beats a legacy time range on parents, children and export', () => {
  expect(
    dateQueries({
      time_range: '2026-11-08 : 2026-11-09',
      adhoc_filters: [dated('session_started_at', 'No filter')],
    }),
  ).toEqual({
    parents: [
      { col: 'session_started_at', op: 'TEMPORAL_RANGE', val: 'No filter' },
    ],
    children: ['session_started_at', 'step_started_at'].map(col => ({
      col,
      op: 'TEMPORAL_RANGE',
      val: 'No filter',
    })),
    exported: [
      { col: 'session_started_at', op: 'TEMPORAL_RANGE', val: 'No filter' },
    ],
    timeRanges: ['No filter'],
    childTime: undefined,
  });
});

test('No filter adds no date filter and preserves other filters', () => {
  const filters = [{ col: 'channel', op: 'IN' as const, val: ['Voice'] }];
  for (const query of buildQuery({
    ...baseFormData,
    levels: [session],
    time_range: 'No filter',
    adhoc_filters: [
      {
        expressionType: 'SIMPLE',
        clause: 'WHERE',
        subject: 'channel',
        operator: 'IN',
        comparator: ['Voice'],
      },
    ],
  }).queries)
    expect(query.filters).toEqual(filters);
});

// Paired with test_guest_parent_page_and_count in tree_table_guest_tests.py.
test('birth_names parent request for the guest HTTP test', () => {
  const { queries } = buildQuery(
    {
      ...baseFormData,
      tree_server_page_length: 50,
      row_limit: 120,
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
      ],
    },
    {
      ownState: {
        sortBy: [{ id: 'gender', key: 'gender', desc: true }],
      },
    },
  );
  expect(
    queries.map(
      ({
        columns,
        metrics,
        orderby,
        filters,
        granularity,
        row_limit,
        row_offset,
        is_rowcount,
        post_processing,
      }) => ({
        columns,
        metrics,
        orderby,
        filters,
        granularity,
        row_limit,
        row_offset,
        is_rowcount,
        post_processing,
      }),
    ),
  ).toEqual([
    {
      columns: ['state', 'gender'],
      metrics: [],
      orderby: [
        ['gender', false],
        ['state', true],
      ],
      filters: [],
      granularity: undefined,
      row_limit: 50,
      row_offset: 0,
      is_rowcount: undefined,
      post_processing: undefined,
    },
    {
      columns: ['state', 'gender'],
      metrics: [],
      orderby: [],
      filters: [],
      granularity: undefined,
      row_limit: 120,
      row_offset: 0,
      is_rowcount: true,
      post_processing: [],
    },
  ]);
});

test('child date options leave the parent queries unchanged with native and chart filters', () => {
  const form = {
    ...baseFormData,
    levels: [
      session,
      { ...step, time_column: 'step_started_at', apply_date_filter: false },
    ],
    time_range: 'Last week',
    extra_form_data: {
      filters: [{ col: 'channel', op: 'IN' as const, val: ['Voice'] }],
    },
  };
  const off = buildQuery(form).queries;
  const on = buildQuery({
    ...form,
    levels: [session, { ...form.levels[1], apply_date_filter: true }],
  }).queries;
  expect(on).toEqual(off);
  expect(on[0].filters).toContainEqual({
    col: 'channel',
    isExtra: true,
    op: 'IN',
    val: ['Voice'],
  });
  expect(on[0].filters).toContainEqual({
    col: 'session_started_at',
    op: 'TEMPORAL_RANGE',
    val: 'Last week',
  });
});

test.each([
  ['json', undefined],
  ['csv', undefined],
  ['xlsx', undefined],
  ['json', { currentPage: 2, searchColumn: 'channel', searchText: 'Vo' }],
  ['csv', { currentPage: 2, searchColumn: 'channel', searchText: 'Vo' }],
  ['xlsx', { currentPage: 2, searchColumn: 'channel', searchText: 'Vo' }],
] as const)(
  'carries the export query for %s (ownState %o)',
  (result_format, ownState) => {
    const formData: TreeTableFormData = {
      ...baseFormData,
      levels: [session, step],
      result_format,
    };
    const frozen = JSON.stringify(formData);
    const context = buildQuery(formData, ownState ? { ownState } : undefined);
    const exported = context.form_data?.tree_export;
    expect(exported.query.columns).toEqual([
      'session_id',
      'channel',
      'duration_ms',
      'inbound_number',
      'step_id',
      'step_name',
      'step_detail',
    ]);
    expect(exported.query.post_processing[0].operation).toBe('tree_rows');
    expect(context.queries).toHaveLength(2);
    expect(context.queries[0].columns).toEqual([
      'session_id',
      'channel',
      'duration_ms',
      'inbound_number',
    ]);
    expect(JSON.stringify(formData)).toBe(frozen);
    expect(formData).not.toHaveProperty('tree_export');
  },
);

test('the export query leaves the page and count queries as they were', () => {
  const formData = {
    ...baseFormData,
    levels: [session, step],
    row_limit: 120,
    tree_server_page_length: 50,
  };
  const context = buildQuery(formData, { ownState: { currentPage: 1 } });
  expect(context.form_data?.tree_export).toBeDefined();
  expect(context.queries[0]).not.toHaveProperty('tree_export');
  expect(context.queries[0]).toMatchObject({
    row_offset: 50,
    row_limit: 50,
    metrics: [],
  });
  expect(context.queries[1]).toMatchObject({
    is_rowcount: true,
    row_limit: 120,
  });
});

test('no export query when level 1 has no ID column', () => {
  expect(
    buildQuery({ ...baseFormData, levels: [{ ...session, id_column: '' }] })
      .form_data,
  ).not.toHaveProperty('tree_export');
  expect(buildQuery(baseFormData).form_data).not.toHaveProperty('tree_export');
});

test('an ID-only parent keeps a single sort pair', () => {
  const level = { ...session, columns: [], detail_fields: [], sort: undefined };
  const { queries } = buildQuery({ ...baseFormData, levels: [level] });
  expect(queries[0].orderby).toEqual([['session_id', true]]);
  expect(queries[1].orderby).toEqual([]);
});

test('parent ties include every other sortable column in level order', () => {
  const level = {
    ...session,
    columns: ['channel', 'duration_ms', 'step_count', 'outcome'],
  };
  const { queries } = buildQuery(
    { ...baseFormData, levels: [level] },
    { ownState: { sortBy: [{ id: 'channel', key: 'channel', desc: true }] } },
  );
  expect(queries[0].orderby).toEqual([
    ['channel', false],
    ['session_id', true],
    ['duration_ms', true],
    ['step_count', true],
    ['outcome', true],
  ]);
  expect(queries[1].orderby).toEqual([]);
});
