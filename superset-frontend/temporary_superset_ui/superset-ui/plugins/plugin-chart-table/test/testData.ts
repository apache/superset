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
import { ChartProps } from '@superset-ui/chart';
import { DatasourceType } from '@superset-ui/query';

const basicFormData = {
  alignPn: false,
  colorPn: false,
  showCellBars: true,
  includeSearch: false,
  orderDesc: true,
  pageLength: 20,
  metrics: [],
  percentMetrics: null,
  timeseriesLimitMetric: null,
  tableFilter: false,
  tableTimestampFormat: '%Y-%m-%d %H:%M:%S',
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
  queryData: {
    data: {
      columns: [],
      records: [],
    },
  },
  formData: basicFormData,
};

/**
 * Basic data input
 */
const basic = {
  ...new ChartProps(basicChartProps),
  queryData: {
    data: {
      columns: ['__timestamp', 'name', 'sum__num'],
      records: [
        {
          __timestamp: '2020-01-01T12:34:56',
          name: 'Michael',
          sum__num: 2467063,
          '%pct_nice': 0.123456,
        },
        {
          __timestamp: 1585932584140,
          name: 'Joe',
          sum__num: 2467,
          '%pct_nice': 0.00001,
        },
      ],
    },
  },
};

/**
 * Advanced data input with
 *   - verbose map
 *   - metric columns
 */
const advanced = {
  ...basic,
  datasource: {
    ...basic.datasource,
    verboseMap: {
      sum__num: 'Sum of Num',
    },
  },
  formData: {
    ...basicFormData,
    metrics: ['sum__num'],
    percentMetrics: ['pct_nice'],
  },
  queryData: {
    data: {
      columns: ['name', 'sum__num', '%pct_nice'],
      records: [...(basic.queryData.data?.records || [])],
    },
  },
};

const empty = {
  ...advanced,
  queryData: {
    ...advanced.queryData,
    data: {
      ...advanced.queryData.data,
      records: [],
    },
  },
};

export default {
  basic,
  advanced,
  empty,
};
