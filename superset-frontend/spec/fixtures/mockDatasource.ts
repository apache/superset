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
import { DatasourceType } from '@superset-ui/core';

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
        id: 1,
        uuid: 'metric-1-uuid',
        expression: 'SUM(birth_names.num)',
        verbose_name: 'sum__num',
        metric_name: 'sum__num',
        metric_type: 'sum',
        certified_by: 'someone',
        certification_details: 'foo',
        warning_markdown: 'bar',
        extra:
          '{"certification":{"details":"foo", "certified_by":"someone"},"warning_markdown":"bar"}',
      },
      {
        id: 2,
        uuid: 'metric-2-uuid',
        expression: 'AVG(birth_names.num)',
        verbose_name: 'avg__num',
        metric_name: 'avg__num',
        metric_type: 'avg',
      },
      {
        id: 3,
        uuid: 'metric-3-uuid',
        expression: 'SUM(birth_names.num_boys)',
        verbose_name: 'sum__num_boys',
        metric_name: 'sum__num_boys',
        metric_type: 'sum',
      },
      {
        id: 4,
        uuid: 'metric-4-uuid',
        expression: 'AVG(birth_names.num_boys)',
        verbose_name: 'avg__num_boys',
        metric_name: 'avg__num_boys',
        metric_type: 'avg',
      },
      {
        id: 5,
        uuid: 'metric-5-uuid',
        expression: 'SUM(birth_names.num_girls)',
        verbose_name: 'sum__num_girls',
        metric_name: 'sum__num_girls',
        metric_type: 'sum',
      },
      {
        id: 6,
        uuid: 'metric-6-uuid',
        expression: 'AVG(birth_names.num_girls)',
        verbose_name: 'avg__num_girls',
        metric_name: 'avg__num_girls',
        metric_type: 'avg',
      },
      {
        id: 7,
        uuid: 'metric-7-uuid',
        expression: 'COUNT(*)',
        verbose_name: 'COUNT(*)',
        metric_name: 'count',
        metric_type: 'count',
      },
    ],
    column_formats: {},
    columns: [
      {
        id: 1,
        type: 'DATETIME',
        filterable: false,
        is_dttm: true,
        is_active: true,
        expression: '',
        groupby: false,
        column_name: 'ds',
      },
      {
        id: 2,
        type: 'VARCHAR(16)',
        filterable: true,
        is_dttm: false,
        is_active: true,
        expression: '',
        groupby: true,
        column_name: 'gender',
      },
      {
        id: 3,
        type: 'VARCHAR(255)',
        filterable: true,
        is_dttm: false,
        is_active: true,
        expression: '',
        groupby: true,
        column_name: 'name',
      },
      {
        id: 4,
        type: 'BIGINT',
        filterable: false,
        is_dttm: false,
        is_active: true,
        expression: '',
        groupby: false,
        column_name: 'num',
      },
      {
        id: 5,
        type: 'VARCHAR(10)',
        filterable: true,
        is_dttm: false,
        is_active: true,
        expression: '',
        groupby: true,
        column_name: 'state',
      },
      {
        id: 6,
        type: 'BIGINT',
        filterable: false,
        is_dttm: false,
        is_active: true,
        expression: '',
        groupby: false,
        column_name: 'num_boys',
      },
      {
        id: 7,
        type: 'BIGINT',
        filterable: false,
        is_dttm: false,
        is_active: true,
        expression: '',
        groupby: false,
        column_name: 'num_girls',
      },
    ],
    column_types: [0, 1, 2],
    id,
    granularity_sqla: [['ds', 'ds']],
    main_dttm_col: 'ds',
    name: 'birth_names',
    owners: [
      { first_name: 'joe', last_name: 'man', id: 1, username: 'joeman' },
    ],
    database: {
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
    type: DatasourceType.Table,
    description: null,
    is_managed_externally: false,
    normalize_columns: false,
    always_filter_main_dttm: false,
    datasource_name: null,
  },
};
