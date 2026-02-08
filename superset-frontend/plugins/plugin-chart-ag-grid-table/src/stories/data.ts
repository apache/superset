/*
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

import { GenericDataType } from '@apache-superset/core/api/core';
import { ChartDataResponseResult, VizType } from '@superset-ui/core';
import { TableChartFormData } from '../types';

export const basicFormData: TableChartFormData = {
  datasource: '1__table',
  viz_type: VizType.Table,
  align_pn: false,
  color_pn: false,
  include_search: true,
  metrics: ['sum__num', 'MAX(ds)'],
  order_desc: true,
  page_length: 0,
  percent_metrics: null,
  show_cell_bars: true,
  table_timestamp_format: 'smart_date',
};

export const basicData: Partial<ChartDataResponseResult> = {
  colnames: ['name', 'sum__num', 'MAX(ds)', 'category'],
  coltypes: [
    GenericDataType.String,
    GenericDataType.Numeric,
    GenericDataType.Temporal,
    GenericDataType.String,
  ],
  data: [
    {
      name: 'Michael',
      sum__num: 2467063,
      'MAX(ds)': '2008-01-01T00:00:00',
      category: 'A',
    },
    {
      name: 'Christopher',
      sum__num: 1725265,
      'MAX(ds)': '2008-01-01T00:00:00',
      category: 'B',
    },
    {
      name: 'David',
      sum__num: 1570516,
      'MAX(ds)': '2008-01-01T00:00:00',
      category: 'A',
    },
    {
      name: 'James',
      sum__num: 1506025,
      'MAX(ds)': '2008-01-01T00:00:00',
      category: 'C',
    },
    {
      name: 'John',
      sum__num: 1426074,
      'MAX(ds)': '2008-01-01T00:00:00',
      category: 'B',
    },
    {
      name: 'Matthew',
      sum__num: 1355803,
      'MAX(ds)': '2008-01-01T00:00:00',
      category: 'A',
    },
    {
      name: 'Robert',
      sum__num: 1314800,
      'MAX(ds)': '2008-01-01T00:00:00',
      category: 'C',
    },
    {
      name: 'Daniel',
      sum__num: 1159354,
      'MAX(ds)': '2008-01-01T00:00:00',
      category: 'B',
    },
    {
      name: 'Joseph',
      sum__num: 1114098,
      'MAX(ds)': '2008-01-01T00:00:00',
      category: 'A',
    },
    {
      name: 'William',
      sum__num: 1113701,
      'MAX(ds)': '2008-01-01T00:00:00',
      category: 'C',
    },
  ],
};
