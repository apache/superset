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
export const id = 7;
export const datasourceId = `${id}__table`;

export default {
  [datasourceId]: {
    verbose_map: {
      count: 'COUNT(*)',
      __timestamp: 'Time',
      sum__num_girls: 'sum__num_girls',
      name: 'name',
      avg__num_girls: 'avg__num_girls',
      gender: 'gender',
      num_girls: 'num_girls',
      ds: 'ds',
      sum__num_boys: 'sum__num_boys',
      state: 'state',
      num: 'num',
      sum__num: 'sum__num',
      num_boys: 'num_boys',
      avg__num: 'avg__num',
      avg__num_boys: 'avg__num_boys',
    },
    metrics: [
      {
        expression: 'SUM(birth_names.num)',
        warning_text: null,
        verbose_name: 'sum__num',
        metric_name: 'sum__num',
        description: null,
        extra:
          '{"certification":{"details":"foo", "certified_by":"someone"},"warning_markdown":"bar"}',
      },
      {
        expression: 'AVG(birth_names.num)',
        warning_text: null,
        verbose_name: 'avg__num',
        metric_name: 'avg__num',
        description: null,
      },
      {
        expression: 'SUM(birth_names.num_boys)',
        warning_text: null,
        verbose_name: 'sum__num_boys',
        metric_name: 'sum__num_boys',
        description: null,
      },
      {
        expression: 'AVG(birth_names.num_boys)',
        warning_text: null,
        verbose_name: 'avg__num_boys',
        metric_name: 'avg__num_boys',
        description: null,
      },
      {
        expression: 'SUM(birth_names.num_girls)',
        warning_text: null,
        verbose_name: 'sum__num_girls',
        metric_name: 'sum__num_girls',
        description: null,
      },
      {
        expression: 'AVG(birth_names.num_girls)',
        warning_text: null,
        verbose_name: 'avg__num_girls',
        metric_name: 'avg__num_girls',
        description: null,
      },
      {
        expression: 'COUNT(*)',
        warning_text: null,
        verbose_name: 'COUNT(*)',
        metric_name: 'count',
        description: null,
      },
    ],
    column_formats: {},
    columns: [
      {
        type: 'DATETIME',
        description: null,
        filterable: false,
        verbose_name: null,
        is_dttm: true,
        expression: '',
        groupby: false,
        column_name: 'ds',
      },
      {
        type: 'VARCHAR(16)',
        description: null,
        filterable: true,
        verbose_name: null,
        is_dttm: false,
        expression: '',
        groupby: true,
        column_name: 'gender',
      },
      {
        type: 'VARCHAR(255)',
        description: null,
        filterable: true,
        verbose_name: null,
        is_dttm: false,
        expression: '',
        groupby: true,
        column_name: 'name',
      },
      {
        type: 'BIGINT',
        description: null,
        filterable: false,
        verbose_name: null,
        is_dttm: false,
        expression: '',
        groupby: false,
        column_name: 'num',
      },
      {
        type: 'VARCHAR(10)',
        description: null,
        filterable: true,
        verbose_name: null,
        is_dttm: false,
        expression: '',
        groupby: true,
        column_name: 'state',
      },
      {
        type: 'BIGINT',
        description: null,
        filterable: false,
        verbose_name: null,
        is_dttm: false,
        expression: '',
        groupby: false,
        column_name: 'num_boys',
      },
      {
        type: 'BIGINT',
        description: null,
        filterable: false,
        verbose_name: null,
        is_dttm: false,
        expression: '',
        groupby: false,
        column_name: 'num_girls',
      },
    ],
    column_types: [0, 1, 2],
    id,
    granularity_sqla: [['ds', 'ds']],
    name: 'birth_names',
    owners: [{ first_name: 'joe', last_name: 'man', id: 1 }],
    database: {
      allow_multi_schema_metadata_fetch: null,
      name: 'main',
      backend: 'sqlite',
    },
    time_grain_sqla: [
      [null, 'Time Column'],
      ['PT1H', 'hour'],
      ['P1D', 'day'],
      ['P1W', 'week'],
      ['P1M', 'month'],
    ],
    filter_select: true,
    order_by_choices: [
      ['["ds", true]', 'ds [asc]'],
      ['["ds", false]', 'ds [desc]'],
      ['["gender", true]', 'gender [asc]'],
      ['["gender", false]', 'gender [desc]'],
      ['["name", true]', 'name [asc]'],
      ['["name", false]', 'name [desc]'],
      ['["num", true]', 'num [asc]'],
      ['["num", false]', 'num [desc]'],
      ['["state", true]', 'state [asc]'],
      ['["state", false]', 'state [desc]'],
      ['["num_boys", true]', 'num_boys [asc]'],
      ['["num_boys", false]', 'num_boys [desc]'],
      ['["num_girls", true]', 'num_girls [asc]'],
      ['["num_girls", false]', 'num_girls [desc]'],
    ],
    type: 'table',
    edit_url: '/tablemodelview/edit/7',
  },
};
