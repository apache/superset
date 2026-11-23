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
  ComparisonType,
  getChartBuildQueryRegistry,
  getChartTransformPropsRegistry,
  QueryMode,
  VizType,
} from '@superset-ui/core';
import AgGridTableChartPlugin from '../src';
import buildQuery from '../src/buildQuery';
import transformProps from '../src/transformProps';
import { TableChartFormData } from '../src/types';
import testData from '../../plugin-chart-table/test/testData';
import { treeFormData, retainedTableControls } from './treeModeFixtures';
import treeBuildQuery from '../src/TreeTable/buildQuery';
import treeTransformProps from '../src/TreeTable/transformProps';
import transformPropsByMode from '../src/transformPropsByMode';
import { TreeTableChartProps } from '../src/TreeTable/types';

const key = 'table-v2-dispatch-regression';
new AgGridTableChartPlugin().configure({ key }).register();

test('registered Tree parent page, count and export ignore retained Table V2 controls', () => {
  const registered = getChartBuildQueryRegistry().get(key);
  if (typeof registered !== 'function')
    throw new Error('Builder is not registered');
  const expected = treeBuildQuery(treeFormData);
  const actual = registered({ ...treeFormData, ...retainedTableControls });
  expect(actual.queries).toEqual(expected.queries);
  expect(actual.form_data?.tree_export).toEqual(
    expected.form_data?.tree_export,
  );
  expect(actual.queries).toHaveLength(2);
  expect(actual.form_data).not.toHaveProperty('server_pagination');
  expect(actual.form_data).not.toHaveProperty('server_page_length');
  expect(expected.form_data).not.toHaveProperty('server_pagination');
  expect(registered(treeFormData)).toEqual(expected);
});

test('Tree transform dispatch preserves raw input and forwards chart-state hook', () => {
  const props = {
    ...testData.basic,
    formData: treeFormData,
    rawFormData: treeFormData,
    hooks: { onChartStateChange: jest.fn() },
  } as unknown as TreeTableChartProps;
  const { columns: actualColumns, ...actual } = transformPropsByMode(props);
  const { columns: expectedColumns, ...expected } = treeTransformProps(props);
  expect(actual).toEqual({
    ...expected,
    queryMode: 'tree',
    onChartStateChange: props.hooks.onChartStateChange,
  });
  const formattedColumns = (columns: typeof expectedColumns) =>
    columns.map(({ formatter, ...column }) => ({
      ...column,
      formatted: formatter?.(42),
    }));
  expect(formattedColumns(actualColumns as typeof expectedColumns)).toEqual(
    formattedColumns(expectedColumns),
  );
});

test.each([
  [undefined, 50],
  [20, 20],
  [25, 50],
] as const)(
  'Tree page setting %s controls the parent query and pager independently of Table V2',
  (treePageLength, expectedSize) => {
    const formData = {
      ...treeFormData,
      tree_server_page_length: treePageLength,
      server_page_length: 25,
    };
    const context = treeBuildQuery(formData);
    expect(context.queries[0]).toMatchObject({
      row_limit: expectedSize,
      row_offset: 0,
    });
    expect(context.queries[1].row_limit).toBe(treeFormData.row_limit);
    expect(context.form_data).not.toHaveProperty('server_page_length');
    expect(context.form_data?.tree_export).toEqual(
      treeBuildQuery(treeFormData).form_data?.tree_export,
    );
    const props = {
      ...testData.basic,
      formData,
      rawFormData: formData,
    } as unknown as TreeTableChartProps;
    expect(treeTransformProps(props)).toMatchObject({
      pageSize: expectedSize,
      serverPageLength: expectedSize,
    });
  },
);

test('viewer Tree page-size changes override the Tree author setting without writing either form value', () => {
  const formData = {
    ...treeFormData,
    tree_server_page_length: 20,
    server_page_length: 25,
  };
  const ownState = { pageSize: 100, currentPage: 1 };
  expect(treeBuildQuery(formData, { ownState }).queries[0]).toMatchObject({
    row_limit: 100,
    row_offset: 100,
  });
  expect(
    treeTransformProps({
      ...testData.basic,
      formData,
      rawFormData: formData,
      ownState,
    } as unknown as TreeTableChartProps),
  ).toMatchObject({ pageSize: 100, serverPageLength: 20 });
  expect(formData.tree_server_page_length).toBe(20);
  expect(formData.server_page_length).toBe(25);
});

const base: TableChartFormData = {
  viz_type: VizType.TableAgGrid,
  datasource: '1__table',
  query_mode: QueryMode.Aggregate,
  groupby: ['name'],
  metrics: ['count'],
};

test.each<TableChartFormData>([
  base,
  { ...base, percent_metrics: ['count'], show_totals: true },
  {
    ...base,
    time_compare: ['1 year ago'],
    comparison_type: ComparisonType.Values,
  },
  {
    ...base,
    query_mode: QueryMode.Raw,
    all_columns: ['name'],
    order_by_cols: ['["name",true]'],
  },
  { ...base, server_pagination: true, server_page_length: 20 },
  { ...base, server_pagination: true, result_format: 'csv' },
  { ...base, datasource: '1__semantic_view', server_pagination: true },
])('registered query builder preserves Table V2 fixture %#', formData => {
  const options = {
    ownState: {
      currentPage: 1,
      pageSize: 20,
      sortBy: [{ key: 'name', desc: false }],
      searchText: 'A',
      agGridFilterModel: {
        name: { filterType: 'text', type: 'contains', filter: 'A' },
      },
      sortModel: [{ colId: 'name', sort: 'asc' }],
    },
  };
  const registered = getChartBuildQueryRegistry().get(key);
  if (typeof registered !== 'function')
    throw new Error('Builder is not registered');
  expect(registered(formData, options)).toEqual(buildQuery(formData, options));
});

test.each([
  ['aggregate', testData.basic],
  [
    'raw',
    { ...testData.basic, rawFormData: { ...base, query_mode: QueryMode.Raw } },
  ],
  ['comparison', testData.comparison],
  [
    'totals',
    { ...testData.basic, rawFormData: { ...base, show_totals: true } },
  ],
])('registered transform preserves Table V2 %s', (_mode, props) => {
  const registered = getChartTransformPropsRegistry().get(key);
  if (typeof registered !== 'function')
    throw new Error('Transform is not registered');
  const stableProps = {
    ...props,
    hooks: { ...props.hooks, setDataMask: jest.fn() },
  };
  transformProps(stableProps);
  const direct = transformProps(stableProps);
  const result = registered(stableProps);
  expect(result).toEqual(direct);
  expect(result.data).toBe(direct.data);
});
