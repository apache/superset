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
  ChartDataResponseResult,
  ChartProps,
  DatasourceType,
  VizType,
  QueryFormData,
} from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/ui';
import { GenericDataType } from '@apache-superset/core/api/core';

const basicFormData: QueryFormData = {
  datasource: '1__table',
  viz_type: VizType.PivotTable,
  groupbyRows: ['country'],
  groupbyColumns: ['city'],
  metrics: ['SUM(sales)'],
  metricsLayout: 'COLUMNS',
  rowOrder: 'key_a_to_z',
  colOrder: 'key_a_to_z',
  aggregateFunction: 'Sum',
  rowSubTotals: false,
  colTotals: true,
  colSubTotals: false,
  rowTotals: true,
  valueFormat: 'SMART_NUMBER',
  dateFormat: 'smart_date',
  transposePivot: false,
  combineMetric: false,
  rowSubtotalPosition: false,
  colSubtotalPosition: false,
};

const basicChartProps = {
  width: 800,
  height: 600,
  datasource: {
    id: 1,
    name: 'test_dataset',
    type: DatasourceType.Table,
    columns: [],
    metrics: [],
    columnFormats: {},
    verboseMap: {},
  },
  hooks: {},
  initialValues: {},
  queriesData: [
    {
      data: {
        columns: [],
        records: [],
      },
    },
  ],
  formData: basicFormData,
  theme: supersetTheme,
};

const basicQueryResult: ChartDataResponseResult = {
  annotation_data: null,
  cache_key: null,
  cached_dttm: null,
  cache_timeout: null,
  data: [],
  colnames: [],
  coltypes: [],
  error: null,
  is_cached: false,
  query: 'SELECT ...',
  rowcount: 100,
  sql_rowcount: 100,
  stacktrace: null,
  status: 'success',
  from_dttm: null,
  to_dttm: null,
};

// Shared test data
const pivotData = [
  { country: 'France', city: 'Paris', 'SUM(sales)': 1000 },
  { country: 'Germany', city: 'Berlin', 'SUM(sales)': 2000 },
  { country: 'Spain', city: 'Madrid', 'SUM(sales)': 1500 },
  { country: 'Italy', city: 'Rome', 'SUM(sales)': 3000 },
  { country: 'UK', city: 'London', 'SUM(sales)': 2500 },
];

// Shared query result structure
const basicQueriesData = [
  {
    ...basicQueryResult,
    colnames: ['country', 'city', 'SUM(sales)'],
    coltypes: [
      GenericDataType.String,
      GenericDataType.String,
      GenericDataType.Numeric,
    ],
    data: pivotData,
  },
];

/**
 * Pivot table data with colTotals enabled
 */
const withColTotals = {
  ...new ChartProps({
    ...basicChartProps,
    formData: {
      ...basicFormData,
      colTotals: true,
      rowTotals: true,
      rowSubTotals: false,
      colSubTotals: false,
    },
  }),
  queriesData: basicQueriesData,
};

/**
 * Pivot table data without colTotals
 */
const withoutColTotals = {
  ...new ChartProps({
    ...basicChartProps,
    formData: {
      ...basicFormData,
      colTotals: false,
      rowTotals: false,
      rowSubTotals: false,
      colSubTotals: false,
    },
  }),
  queriesData: basicQueriesData,
};

export default {
  withColTotals,
  withoutColTotals,
};
