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

const key = 'table-v2-dispatch-regression';
new AgGridTableChartPlugin().configure({ key }).register();

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
