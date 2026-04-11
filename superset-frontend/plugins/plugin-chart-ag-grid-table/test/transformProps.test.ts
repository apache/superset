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
import transformProps from '../src/transformProps';
import { TableChartProps } from '../src/types';
import { GenericDataType } from '@apache-superset/core/common';
import { QueryMode } from '@superset-ui/core';

function createMockChartProps(
  overrides: Partial<TableChartProps> = {},
): TableChartProps {
  const defaultProps = {
    height: 400,
    width: 800,
    rawFormData: {
      viz_type: 'table',
      datasource: '1__table',
      query_mode: QueryMode.Aggregate,
      metrics: [],
      percent_metrics: [],
      column_config: {},
      table_timestamp_format: '',
      granularity_sqla: 'day',
      time_range: 'No filter',
    },
    queriesData: [
      {
        data: [],
        colnames: [],
        coltypes: [],
        rowcount: 0,
        applied_filters: [],
        rejected_filters: [],
      },
    ],
    datasource: {
      columns: [],
      metrics: [],
      columnFormats: {},
      currencyFormats: {},
      verboseMap: {},
    },
    rawDatasource: {
      columns: [],
      metrics: [],
    },
    filterState: {},
    hooks: { setDataMask: jest.fn(), onChartStateChange: jest.fn() },
    ownState: {},
    emitCrossFilters: false,
    theme: {},
    ...overrides,
  };
  return defaultProps as unknown as TableChartProps;
}

test('extracts description from datasource.columns for a regular column', () => {
  const props = createMockChartProps({
    queriesData: [
      {
        data: [{ col1: 'value' }],
        colnames: ['col1'],
        coltypes: [GenericDataType.String],
        rowcount: 1,
        applied_filters: [],
        rejected_filters: [],
      } as any,
    ],
    rawDatasource: {
      columns: [
        { column_name: 'col1', description: 'This is a column description' },
      ],
      metrics: [],
    },
  });

  const result = transformProps(props);
  const {columns} = result;
  const columnMeta = columns.find(c => c.key === 'col1');
  expect(columnMeta).toBeDefined();
  expect(columnMeta!.description).toBe('This is a column description');
});

test('extracts description from datasource.metrics for a metric column', () => {
  const props = createMockChartProps({
    rawFormData: {
      viz_type: 'table',
      datasource: '1__table',
      query_mode: QueryMode.Aggregate,
      metrics: ['sum_sales'],
      percent_metrics: [],
      column_config: {},
      table_timestamp_format: '',
      granularity_sqla: 'day',
      time_range: 'No filter',
    },
    queriesData: [
      {
        data: [{ sum_sales: 100 }],
        colnames: ['sum_sales'],
        coltypes: [GenericDataType.Numeric],
        rowcount: 1,
        applied_filters: [],
        rejected_filters: [],
      },
    ] as any,
    rawDatasource: {
      columns: [],
      metrics: [
        { metric_name: 'sum_sales', description: 'Total sales amount' },
      ],
    },
  });

  const result = transformProps(props);
  const {columns} = result;
  const columnMeta = columns.find(c => c.key === 'sum_sales');
  expect(columnMeta).toBeDefined();
  expect(columnMeta!.description).toBe('Total sales amount');
});

test('prefers column description over metric description when both exist with same key', () => {
  const props = createMockChartProps({
    rawFormData: {
      viz_type: 'table',
      datasource: '1__table',
      query_mode: QueryMode.Aggregate,
      metrics: ['revenue'],
      percent_metrics: [],
      column_config: {},
      table_timestamp_format: '',
      granularity_sqla: 'day',
      time_range: 'No filter',
    },
    queriesData: [
      {
        data: [{ revenue: 500 }],
        colnames: ['revenue'],
        coltypes: [GenericDataType.Numeric],
        rowcount: 1,
        applied_filters: [],
        rejected_filters: [],
      },
    ] as any,
    rawDatasource: {
      columns: [{ column_name: 'revenue', description: 'Column desc' }],
      metrics: [{ metric_name: 'revenue', description: 'Metric desc' }],
    },
  });

  const result = transformProps(props);
  const {columns} = result;
  const columnMeta = columns.find(c => c.key === 'revenue');
  expect(columnMeta!.description).toBe('Column desc');
});

test('handles percent metrics correctly – uses base metric name for lookup', () => {
  const props = createMockChartProps({
    rawFormData: {
      viz_type: 'table',
      datasource: '1__table',
      query_mode: QueryMode.Aggregate,
      metrics: ['profit'],
      percent_metrics: ['profit'],
      column_config: {},
      table_timestamp_format: '',
      granularity_sqla: 'day',
      time_range: 'No filter',
    },
    queriesData: [
      {
        data: [{ '%profit': 0.15 }],
        colnames: ['%profit'],
        coltypes: [GenericDataType.Numeric],
        rowcount: 1,
        applied_filters: [],
        rejected_filters: [],
      },
    ] as any,
    rawDatasource: {
      columns: [],
      metrics: [
        { metric_name: 'profit', description: 'Profit margin percent' },
      ],
    },
  });

  const result = transformProps(props);
  const {columns} = result;
  const columnMeta = columns.find(c => c.key === '%profit');
  expect(columnMeta).toBeDefined();
  expect(columnMeta!.description).toBe('Profit margin percent');
});

test('sets description to undefined when no matching column or metric is found', () => {
  const props = createMockChartProps({
    queriesData: [
      {
        data: [{ unknown_col: 'x' }],
        colnames: ['unknown_col'],
        coltypes: [GenericDataType.String],
        rowcount: 1,
        applied_filters: [],
        rejected_filters: [],
      },
    ] as any,
    rawDatasource: {
      columns: [],
      metrics: [],
    },
  });

  const result = transformProps(props);
  const {columns} = result;
  const columnMeta = columns.find(c => c.key === 'unknown_col');
  expect(columnMeta!.description).toBeUndefined();
});

test('uses description from column even when verboseMap renames the column', () => {
  const props = createMockChartProps({
    queriesData: [
      {
        data: [{ col_x: 10 }],
        colnames: ['col_x'],
        coltypes: [GenericDataType.Numeric],
        rowcount: 1,
        applied_filters: [],
        rejected_filters: [],
      },
    ] as any,
    datasource: {
      columns: [],
      metrics: [],
      columnFormats: {},
      currencyFormats: {},
      verboseMap: { col_x: 'Custom Label' },
    } as any,
    rawDatasource: {
      columns: [
        { column_name: 'col_x', description: 'Original column description' },
      ],
      metrics: [],
    },
  });

  const result = transformProps(props);
  const {columns} = result;
  const columnMeta = columns.find(c => c.key === 'col_x');
  expect(columnMeta!.label).toBe('Custom Label');
  expect(columnMeta!.description).toBe('Original column description');
});
