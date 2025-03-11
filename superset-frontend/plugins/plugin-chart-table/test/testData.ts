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
  GenericDataType,
  QueryMode,
  supersetTheme,
  ComparisonType,
  VizType,
} from '@superset-ui/core';
import { TableChartProps, TableChartFormData } from '../src/types';

const basicFormData: TableChartFormData = {
  datasource: '1__abc',
  viz_type: VizType.Table,
  align_pn: false,
  color_pn: false,
  show_cell_bars: true,
  include_search: false,
  order_desc: true,
  page_length: 20,
  metrics: [],
  percent_metrics: null,
  timeseries_limit_metric: '',
  table_filter: false,
  table_timestamp_format: '%Y-%m-%d %H:%M:%S',
};

const basicChartProps = {
  width: 200,
  height: 500,
  datasource: {
    id: 0,
    name: '',
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

/**
 * Basic data input
 */
const basic: TableChartProps = {
  ...new ChartProps(basicChartProps),
  queriesData: [
    {
      ...basicQueryResult,
      colnames: ['__timestamp', 'name', 'sum__num', 'abc.com'],
      coltypes: [
        GenericDataType.Temporal,
        GenericDataType.String,
        GenericDataType.Numeric,
        GenericDataType.String,
      ],
      data: [
        {
          __timestamp: '2020-01-01T12:34:56',
          name: 'Michael',
          sum__num: 2467063,
          '%pct_nice': 0.123456,
          'abc.com': 'foo',
        },
        {
          __timestamp: 1585932584140,
          name: 'Joe',
          sum__num: 2467,
          '%pct_nice': 0.00001,
          'abc.com': 'bar',
        },
        {
          __timestamp: null,
          name: 'Maria',
          sum__num: 12342,
          '%pct_nice': 0.341,
          'abc.com': 'baz',
        },
      ],
    },
  ],
};

/**
 * Advanced data input with
 *   - verbose map
 *   - metric columns
 */
const advanced: TableChartProps = {
  ...basic,
  datasource: {
    ...basic.datasource,
    verboseMap: {
      sum__num: 'Sum of Num',
    },
  },
  rawFormData: {
    ...basicFormData,
    metrics: ['sum__num'],
    percent_metrics: ['pct_nice'],
    column_config: {
      name: {
        d3NumberFormat: '.3s',
      },
      sum__num: {
        d3NumberFormat: '.3s',
      },
      pct_nice: {
        d3NumberFormat: '.3s',
      },
      'abc.com': {
        d3NumberFormat: '.3s',
      },
    },
  },
  queriesData: [
    {
      ...basicQueryResult,
      colnames: ['name', 'sum__num', '%pct_nice'],
      coltypes: [
        GenericDataType.String,
        GenericDataType.Numeric,
        GenericDataType.Numeric,
      ],
      data: [...(basic.queriesData[0].data || [])],
    },
  ],
};

const comparison: TableChartProps = {
  ...basic,
  rawFormData: {
    ...basicFormData,
    table_timestamp_format: 'smart_date',
    metrics: ['metric_1', 'metric_2'],
    percent_metrics: ['percent_metric_1'],
    column_config: {},
    align_pn: true,
    color_pn: true,
    show_cell_bars: true,
    include_search: true,
    page_length: 10,
    server_pagination: false,
    order_desc: false,
    query_mode: QueryMode.Aggregate,
    show_totals: true,
    conditional_formatting: [],
    allow_rearrange_columns: true,
    allow_render_html: false,
    time_compare: ['P1D'],
    comparison_color_enabled: true,
    comparison_color_scheme: 'Green',
    comparison_type: ComparisonType.Values,
  },
  queriesData: [
    {
      ...basicQueryResult,
      data: [
        {
          metric_1: 100,
          metric_2: 200,
          percent_metric_1: 0.5,
          date: '2023-01-01',
        },
        {
          metric_1: 110,
          metric_2: 210,
          percent_metric_1: 0.55,
          date: '2023-01-02',
        },
      ],
      colnames: ['metric_1', 'metric_2', 'percent_metric_1', 'date'],
      coltypes: [
        GenericDataType.Numeric,
        GenericDataType.Numeric,
        GenericDataType.Numeric,
        GenericDataType.Temporal,
      ],
    },
    {
      ...basicQueryResult,
      data: [
        {
          metric_1: 10,
          metric_2: 20,
          percent_metric_1: 0.05,
          date: '2023-01-01',
        },
        {
          metric_1: 11,
          metric_2: 21,
          percent_metric_1: 0.055,
          date: '2023-01-02',
        },
      ],
    },
  ],
  filterState: { filters: {} },
  ownState: {},
  hooks: {
    onAddFilter: jest.fn(),
    setDataMask: jest.fn(),
    onContextMenu: jest.fn(),
  },
  emitCrossFilters: true,
};

const comparisonWithConfig: TableChartProps = {
  ...comparison,
  height: 400,
  width: 400,
  rawFormData: {
    ...comparison.rawFormData,
    table_timestamp_format: 'smart_date',
    metrics: ['metric_1'],
    percent_metrics: ['percent_metric_1'],
    column_config: {
      'Main metric_1': { d3NumberFormat: '.2f' },
      '# metric_1': { d3NumberFormat: '.1f' },
      '△ metric_1': { d3NumberFormat: '.0f' },
      '% metric_1': { d3NumberFormat: '.3f' },
    },
    time_compare: ['1 year ago'],
    comparison_color_enabled: true,
    comparison_type: ComparisonType.Values,
  },
  datasource: {
    ...comparison.datasource,
    columnFormats: { metric_1: '.2f' },
    currencyFormats: {},
    verboseMap: { metric_1: 'Metric 1' },
  },
  queriesData: [
    {
      ...basicQueryResult,
      data: [{ metric_1: 100, 'metric_1__1 year ago': 80 }],
      colnames: ['metric_1', 'metric_1__1 year ago'],
      coltypes: [GenericDataType.Numeric, GenericDataType.Numeric],
    },
    {
      ...basicQueryResult,
      data: [{ rowcount: 1 }],
    },
  ],
  filterState: { filters: {} },
  ownState: {},
  hooks: {
    onAddFilter: jest.fn(),
    setDataMask: jest.fn(),
    onContextMenu: jest.fn(),
  },
  emitCrossFilters: false,
};

const raw = {
  ...advanced,
  rawFormData: {
    ...advanced.rawFormData,
    query_mode: QueryMode.Raw,
    columns: ['num'],
  },
  queriesData: [
    {
      ...basicQueryResult,
      colnames: ['num'],
      coltypes: [GenericDataType.Numeric],
      data: [
        {
          num: 1234,
        },
        {
          num: 10000,
        },
        {
          num: 0,
        },
      ],
    },
  ],
};

const advancedWithCurrency = {
  ...advanced,
  datasource: {
    ...advanced.datasource,
    currencyFormats: {
      sum__num: { symbol: 'USD', symbolPosition: 'prefix' },
    },
  },
};

const empty = {
  ...advanced,
  queriesData: [
    {
      ...advanced.queriesData[0],
      data: [],
    },
  ],
};

export default {
  basic,
  advanced,
  advancedWithCurrency,
  comparison,
  comparisonWithConfig,
  empty,
  raw,
};
