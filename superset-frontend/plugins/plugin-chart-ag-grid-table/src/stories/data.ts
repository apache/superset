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
  color_pn: true,
  include_search: true,
  groupby: ['name', 'category'],
  metrics: ['sum__num'],
  order_desc: true,
  page_length: 0,
  percent_metrics: null,
  show_cell_bars: true,
  table_timestamp_format: 'smart_date',
};

export const basicData: Partial<ChartDataResponseResult> = {
  colnames: ['name', 'category', 'sum__num'],
  coltypes: [
    GenericDataType.String,
    GenericDataType.String,
    GenericDataType.Numeric,
  ],
  data: [
    { name: 'Michael', category: 'A', sum__num: 2467063 },
    { name: 'Christopher', category: 'B', sum__num: 1725265 },
    { name: 'David', category: 'A', sum__num: 1570516 },
    { name: 'James', category: 'C', sum__num: 1506025 },
    { name: 'John', category: 'B', sum__num: 1426074 },
    { name: 'Matthew', category: 'A', sum__num: 1355803 },
    { name: 'Robert', category: 'C', sum__num: 1314800 },
    { name: 'Daniel', category: 'B', sum__num: 1159354 },
    { name: 'Joseph', category: 'A', sum__num: 1114098 },
    { name: 'William', category: 'C', sum__num: 1113701 },
  ],
};
