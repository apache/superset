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
import { TableChartProps } from '@superset-ui/plugin-chart-table/src';
// @ts-ignore
// eslint-disable-next-line import/extensions
import birthNamesJson from './birthNames.json';

export const birthNames = (birthNamesJson as unknown) as TableChartProps;
export const basicFormData = {
  alignPn: false,
  colorPn: false,
  includeSearch: false,
  metrics: ['sum__num', 'MAX(ds)'],
  orderDesc: true,
  pageLength: 0,
  percentMetrics: null,
  showCellBars: true,
  tableFilter: false,
  tableTimestampFormat: 'smart_date',
  timeseriesLimitMetric: null,
};
export const basicData = {
  columns: ['name', 'sum__num', 'MAX(ds)', 'Abc.com'],
  records: [
    {
      name: 'Michael',
      sum__num: 2467063,
      'MAX(ds)': '2008-01-01T00:00:00',
      'Abc.com': 110,
    },
    {
      name: 'Christopher',
      sum__num: 1725265,
      'MAX(ds)': '2008-01-01T00:00:00',
      'Abc.com': 119,
    },
    {
      name: 'David',
      sum__num: 1570516,
      'MAX(ds)': '2008-01-01T00:00:00',
      'Abc.com': 120,
    },
    {
      name: 'James',
      sum__num: 1506025,
      'MAX(ds)': '2008-01-01T00:00:00',
      'Abc.com': 120,
    },
    {
      name: 'John',
      sum__num: 1426074,
      'MAX(ds)': '2008-01-01T00:00:00',
      'Abc.com': 120,
    },
    {
      name: 'Matthew',
      sum__num: 1355803,
      'MAX(ds)': '2008-01-01T00:00:00',
      'Abc.com': 120,
    },
    {
      name: 'Robert',
      sum__num: 1314800,
      'MAX(ds)': '2008-01-01T00:00:00',
      'Abc.com': 120,
    },
    {
      name: 'Daniel',
      sum__num: 1159354,
      'MAX(ds)': '2008-01-01T00:00:00',
      'Abc.com': 120,
    },
    {
      name: 'Joseph',
      sum__num: 1114098,
      'MAX(ds)': '2008-01-01T00:00:00',
      'Abc.com': 120,
    },
    {
      name: 'William',
      sum__num: 1113701,
      'MAX(ds)': '2008-01-01T00:00:00',
      'Abc.com': 120,
    },
  ],
};
