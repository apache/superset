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
import {
  ChartProps,
  TimeFormats,
  getTimeFormatter,
  VizType,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { supersetTheme } from '@apache-superset/core/theme';
import transformProps from './transformProps';
import buildChildrenQuery from './buildChildrenQuery';
import { TreeTableFormData, TreeLevel } from './types';

const levels: TreeLevel[] = [
  {
    key: 'session',
    name: 'Session',
    id_column: 'session_id',
    columns: [],
    detail_fields: [],
  },
];
const formData: TreeTableFormData = {
  datasource: '1__table',
  viz_type: VizType.TableAgGrid,
  query_mode: 'tree',
  levels,
};
const defaults = {
  pageSize: 50,
  currentPage: 0,
  serverPageLength: 50,
  ownState: {},
  setDataMask: expect.any(Function),
  emitCrossFilters: false,
  filters: undefined,
  sliceId: 0,
};

test('partial saved levels default missing column and detail lists', () => {
  const savedLevel = {
    key: 'session',
    name: 'Session',
    id_column: 'session_id',
  };
  const transformed = transformProps(
    new ChartProps<TreeTableFormData>({
      formData: {
        ...formData,
        levels: [savedLevel as TreeLevel],
      },
      theme: supersetTheme,
    }),
  );
  expect(transformed.levels).toEqual([
    { ...savedLevel, columns: [], detail_fields: [] },
  ]);
  expect(transformed.columns.map(column => column.key)).toEqual(['session_id']);
});

test('passes levels, data, colnames and rowcount through', () => {
  const props = new ChartProps<TreeTableFormData>({
    width: 100,
    height: 50,
    formData,
    queriesData: [
      {
        data: [{ session_id: 'S1' }, { session_id: 'S2' }],
        colnames: ['session_id'],
        coltypes: [GenericDataType.String],
        rowcount: 2,
      },
      { data: [{ rowcount: 120 }] },
    ],
    theme: supersetTheme,
  });
  expect(transformProps(props)).toEqual({
    ...defaults,
    width: 100,
    height: 50,
    levels,
    data: [{ session_id: 'S1' }, { session_id: 'S2' }],
    colnames: ['session_id'],
    coltypes: [GenericDataType.String],
    rowcount: 120,
    columns: [
      {
        key: 'session_id',
        label: 'session_id',
        dataType: GenericDataType.String,
        formatter: expect.any(Function),
      },
    ],
    rawFormData: formData,
    verboseMap: {},
  });
});

test('a DATE parent ID matches a child link stored as YYYYMMDD', () => {
  const props = new ChartProps<TreeTableFormData>({
    formData: {
      ...formData,
      levels: [
        { ...levels[0], id_column: 'year' },
        {
          ...levels[0],
          key: 'game',
          id_column: 'name',
          parent_column: 'year_link',
        },
      ],
    },
    datasource: {
      columns: [
        { column_name: 'year', type: 'DATE', is_dttm: true },
        {
          column_name: 'year_link',
          is_dttm: true,
          python_date_format: '%Y%m%d',
        },
      ],
    },
    theme: supersetTheme,
  });
  const { rawFormData, linkDateFormats } = transformProps(props);
  expect(linkDateFormats).toEqual(new Map([['year_link', '%Y%m%d']]));
  const { queries } = buildChildrenQuery(rawFormData, {
    ownState: {
      treeTableChildren: {
        level: 1,
        paths: [['315532800000']],
        linkDateFormats,
      },
    },
  });
  expect(queries[0].filters).toContainEqual({
    col: 'year_link',
    op: 'IN',
    val: ['19800101'],
  });
});
test('missing data gives empty data and a zero rowcount', () => {
  expect(
    transformProps(
      new ChartProps<TreeTableFormData>({
        width: 1,
        height: 1,
        formData: {
          datasource: '1__table',
          viz_type: VizType.TableAgGrid,
          query_mode: 'tree',
        },
        queriesData: [],
        theme: supersetTheme,
      }),
    ),
  ).toEqual({
    ...defaults,
    width: 1,
    height: 1,
    levels: [],
    data: [],
    colnames: [],
    coltypes: [],
    rowcount: 0,
    columns: [],
    rawFormData: {
      datasource: '1__table',
      viz_type: VizType.TableAgGrid,
      query_mode: 'tree',
    },
    verboseMap: {},
  });
});
test('real ChartProps uses raw snake-case values and passes hooks and filters', () => {
  const setDataMask = jest.fn();
  const filters = { session_id: ['S1'] };
  const props = new ChartProps<TreeTableFormData>({
    formData: {
      ...formData,
      slice_id: 42,
      tree_server_page_length: 100,
      include_search: true,
    },
    ownState: { currentPage: 2 },
    hooks: { setDataMask },
    filterState: { filters },
    emitCrossFilters: true,
    theme: supersetTheme,
  });
  expect(props.formData.slice_id).toBeUndefined();
  expect(transformProps(props)).toMatchObject({
    sliceId: 42,
    pageSize: 100,
    serverPageLength: 100,
    currentPage: 2,
    ownState: { currentPage: 2 },
    setDataMask,
    filters,
    emitCrossFilters: true,
  });
});
test('columns put ID first, deduplicate, label, format temporal and null values', () => {
  const props = new ChartProps<TreeTableFormData>({
    formData: {
      ...formData,
      levels: [{ ...levels[0], columns: ['time', 'session_id', 'duration'] }],
    },
    datasource: { verboseMap: { session_id: 'Session Id', time: 'Start' } },
    queriesData: [
      {
        data: [],
        colnames: ['time', 'duration', 'session_id'],
        coltypes: [
          GenericDataType.Temporal,
          GenericDataType.Numeric,
          GenericDataType.String,
        ],
      },
    ],
    theme: supersetTheme,
  });
  const { columns } = transformProps(props);
  expect(columns.map(({ key, label }) => [key, label])).toEqual([
    ['session_id', 'Session Id'],
    ['time', 'Start'],
    ['duration', 'duration'],
  ]);
  expect(columns[1].formatter?.(0)).toBe(
    getTimeFormatter(TimeFormats.DATABASE_DATETIME)(0),
  );
  expect(columns[1].formatter?.('2026-11-14')).toBe('2026-11-14');
  for (const column of columns) {
    expect(column.formatter?.(null)).toBe('N/A');
    expect(column.formatter?.(undefined)).toBe('N/A');
  }
  expect(columns[2].formatter?.(123)).toBe('123');
});
test('query and pager share invalid-size and capped-page normalization', () => {
  const props = new ChartProps<TreeTableFormData>({
    formData: { ...formData, tree_server_page_length: 33, row_limit: 120 },
    ownState: { pageSize: 7, currentPage: 3 },
    theme: supersetTheme,
  });
  expect(transformProps(props)).toMatchObject({
    pageSize: 50,
    currentPage: 2,
    sliceId: 0,
  });
});
test('real ChartProps passes raw form data and the verbose map for children requests', () => {
  const rawFormData = {
    ...formData,
    levels: [
      ...levels,
      {
        key: 'step',
        name: 'Step',
        id_column: 'step_id',
        parent_column: 'session_id',
        columns: ['step'],
        detail_fields: [],
      },
    ],
    slice_id: 42,
    dashboardId: 7,
    extra_form_data: { time_range: 'Last week' },
  };
  const props = new ChartProps<TreeTableFormData>({
    formData: rawFormData,
    datasource: { verboseMap: { step: 'Step' } },
    theme: supersetTheme,
  });
  const transformed = transformProps(props);
  expect(transformed.rawFormData).toMatchObject({
    slice_id: 42,
    dashboardId: 7,
    extra_form_data: { time_range: 'Last week' },
  });
  expect(transformed.verboseMap).toEqual({ step: 'Step' });
  const { form_data } = buildChildrenQuery(transformed.rawFormData, {
    ownState: { treeTableChildren: { level: 1, paths: [['S1']] } },
  });
  expect(form_data).toMatchObject({ slice_id: 42, dashboardId: 7 });
});
