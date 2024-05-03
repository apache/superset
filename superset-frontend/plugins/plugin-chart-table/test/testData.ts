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
} from '@superset-ui/core';
import { TableChartProps, TableChartFormData } from '../src/types';

const basicFormData: TableChartFormData = {
  datasource: '1__abc',
  viz_type: 'table',
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
  empty,
  raw,
};
