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

const basicFormData = {
  alignPn: false,
  colorPn: false,
  includeSearch: false,
  orderDesc: true,
  pageLength: 0,
  metrics: [],
  percentMetrics: null,
  timeseriesLimitMetric: null,
  tableFilter: false,
  tableTimestampFormat: '%Y-%m-%d %H:%M:%S',
};

const basicChartProps = {
  width: 200,
  height: 500,
  annotationData: {},
  datasource: {
    columnFormats: {},
    verboseMap: {},
  },
  rawDatasource: {},
  rawFormData: {},
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
const basic: ChartProps = {
  ...basicChartProps,
  queryData: {
    data: {
      columns: ['name', 'sum__num'],
      records: [
        {
          name: 'Michael',
          sum__num: 2467063,
          '%pct_nice': 0.123456,
        },
        {
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
const advanced: ChartProps = {
  ...basic,
  datasource: {
    columnFormats: {},
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
      records: [...basic.queryData.data.records],
    },
  },
};

export default {
  basic,
  advanced,
};
