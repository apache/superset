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
import { TreeTableFormData } from '../src/TreeTable/types';
import { TimeGranularity } from '@superset-ui/core';

export const treeFormData: TreeTableFormData = {
  viz_type: 'ag-grid-table',
  query_mode: 'tree',
  datasource: '1__table',
  tree_server_page_length: 50,
  row_limit: 1000,
  levels: [
    {
      key: 'parent',
      name: 'Parent',
      id_column: 'parent',
      time_column: 'ds',
      columns: ['value'],
      detail_fields: [],
    },
    {
      key: 'child',
      name: 'Child',
      id_column: 'child',
      parent_column: 'parent',
      columns: ['value'],
      detail_fields: [],
      children_shown: 100,
    },
  ],
};

export const retainedTableControls = {
  server_page_length: 25,
  groupby: ['unused'],
  metrics: ['unused_metric'],
  all_columns: ['unused'],
  percent_metrics: ['unused_metric'],
  order_by_cols: ['invalid retained JSON'],
  timeseries_limit_metric: 'unused_metric',
  series_limit_metric: 'unused_metric',
  order_desc: true,
  time_grain_sqla: TimeGranularity.DAY,
  time_compare: ['1 year ago'],
  comparison_type: 'values',
  server_pagination: true,
  show_totals: true,
};
