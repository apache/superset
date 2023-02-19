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
export const basicFormData = {
  datasource: '1__table',
  viz_type: 'pivot_table_v2',
  granularity_sqla: 'ts',
  groupbyColumns: ['location'],
  groupbyRows: ['program_language'],
  metrics: [
    {
      expressionType: 'SIMPLE',
      column: {
        id: 1,
        column_name: 'count',
        description: null,
        expression: null,
        groupby: true,
        is_dttm: false,
        python_date_format: null,
        type: 'BIGINT',
        type_generic: 0,
      },
      aggregate: 'SUM',
      sqlExpression: null,
      isNew: false,
      hasCustomLabel: true,
      label: 'Count',
    },
    {
      expressionType: 'SIMPLE',
      column: {
        id: 2,
        column_name: 'ts',
        description: null,
        expression: "DATE_PARSE(ds || ' ' || hr, '%Y-%m-%d %H')",
        groupby: true,
        is_dttm: true,
        type: 'TIMESTAMP',
        type_generic: 2,
        python_date_format: null,
      },
      aggregate: 'MAX',
      sqlExpression: null,
      isNew: false,
      hasCustomLabel: true,
      label: 'Most Recent Data',
    },
  ],
  metricsLayout: 'COLUMNS',
  order_desc: true,
  aggregateFunction: 'Sum',
  valueFormat: '~g',
  date_format: 'smart_date',
  rowOrder: 'key_a_to_z',
  colOrder: 'key_a_to_z',
};

export const basicData = {
  cache_key: 'f2cd2a37b6977e3619ce6c07d0027972',
  cached_dttm: '2022-07-27T17:42:39',
  cache_timeout: 129600,
  applied_template_filters: [],
  annotation_data: {},
  error: null,
  is_cached: true,
  query: 'SELECT \nFROM\nWHERE',
  status: 'success',
  stacktrace: null,
  rowcount: 5,
  from_dttm: 1658426268000,
  to_dttm: 1659031068000,
  colnames: ['location', 'program_language', 'Count', 'Most Recent Data'],
  indexnames: [0, 1, 2, 3, 4],
  coltypes: [1, 1, 0, 1],
  data: [
    {
      location: 'AMEA',
      program_language: 'JavaScript',
      Count: 134,
      'Most Recent Data': '2022-07-25 13:00:00.000',
    },
    {
      location: 'ASIA',
      program_language: 'python',
      Count: 19,
      'Most Recent Data': '2022-07-25 16:00:00.000',
    },
    {
      location: 'ASIA',
      program_language: 'Java',
      Count: 7,
      'Most Recent Data': '2022-07-25 15:00:00.000',
    },
    {
      location: 'ASIA',
      program_language: 'C++',
      Count: 1,
      'Most Recent Data': '2022-07-25 02:00:00.000',
    },
    {
      location: 'ASIA',
      program_language: 'PHP',
      Count: 1,
      'Most Recent Data': '2022-07-24 00:00:00.000',
    },
  ],
  result_format: 'json',
  applied_filters: [],
  rejected_filters: [],
};
