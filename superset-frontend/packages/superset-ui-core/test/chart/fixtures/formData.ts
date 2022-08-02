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

/* eslint sort-keys: 'off' */
/** The form data defined here is based on default visualizations packaged with Apache Superset */

export const bigNumberFormData = {
  datasource: '3__table',
  viz_type: 'big_number',
  slice_id: 54,
  granularity_sqla: 'ds',
  time_grain_sqla: 'P1D',
  time_range: '100 years ago : now',
  metric: 'sum__num',
  adhoc_filters: [],
  compare_lag: '5',
  compare_suffix: 'over 5Y',
  y_axis_format: '.3s',
  show_trend_line: true,
  start_y_axis_at_zero: true,
};

export const wordCloudFormData = {
  datasource: '3__table',
  viz_type: 'word_cloud',
  slice_id: 60,
  url_params: {},
  granularity_sqla: 'ds',
  time_grain_sqla: 'P1D',
  time_range: '100 years ago : now',
  series: 'name',
  metric: 'sum__num',
  adhoc_filters: [],
  row_limit: 50,
  size_from: 10,
  size_to: 70,
  rotation: 'square',
};

export const sunburstFormData = {
  datasource: '2__table',
  viz_type: 'sunburst',
  slice_id: 47,
  url_params: {},
  granularity_sqla: 'year',
  time_grain_sqla: 'P1D',
  time_range: '2011-01-01 : 2011-01-01',
  groupby: ['region', 'country_name'],
  metric: 'sum__SP_POP_TOTL',
  secondary_metric: 'sum__SP_RUR_TOTL',
  adhoc_filters: [],
  row_limit: 10000,
};

export const sankeyFormData = {
  datasource: '1__table',
  viz_type: 'sankey',
  slice_id: 1,
  url_params: {},
  granularity_sqla: null,
  time_grain_sqla: 'P1D',
  time_range: 'Last week',
  groupby: ['source', 'target'],
  metric: 'sum__value',
  adhoc_filters: [],
  row_limit: 1000,
};
