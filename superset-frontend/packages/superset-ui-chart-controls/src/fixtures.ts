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
import { Dataset } from './types';

export const TestDataset: Dataset = {
  column_formats: {},
  columns: [
    {
      advanced_data_type: undefined,
      certification_details: null,
      certified_by: null,
      column_name: 'num',
      description: null,
      expression: '',
      filterable: true,
      groupby: true,
      id: 332,
      is_certified: false,
      is_dttm: false,
      python_date_format: null,
      type: 'BIGINT',
      type_generic: 0,
      verbose_name: null,
      warning_markdown: null,
    },
    {
      advanced_data_type: undefined,
      certification_details: null,
      certified_by: null,
      column_name: 'gender',
      description: null,
      expression: '',
      filterable: true,
      groupby: true,
      id: 330,
      is_certified: false,
      is_dttm: false,
      python_date_format: null,
      type: 'VARCHAR(16)',
      type_generic: 1,
      verbose_name: '',
      warning_markdown: null,
    },
    {
      advanced_data_type: undefined,
      certification_details: null,
      certified_by: null,
      column_name: 'state',
      description: null,
      expression: '',
      filterable: true,
      groupby: true,
      id: 333,
      is_certified: false,
      is_dttm: false,
      python_date_format: null,
      type: 'VARCHAR(10)',
      type_generic: 1,
      verbose_name: null,
      warning_markdown: null,
    },
    {
      advanced_data_type: undefined,
      certification_details: null,
      certified_by: null,
      column_name: 'ds',
      description: null,
      expression: '',
      filterable: true,
      groupby: true,
      id: 329,
      is_certified: false,
      is_dttm: true,
      python_date_format: null,
      type: 'TIMESTAMP WITHOUT TIME ZONE',
      type_generic: 2,
      verbose_name: null,
      warning_markdown: null,
    },
    {
      advanced_data_type: undefined,
      certification_details: null,
      certified_by: null,
      column_name: 'name',
      description: null,
      expression: '',
      filterable: true,
      groupby: true,
      id: 331,
      is_certified: false,
      is_dttm: false,
      python_date_format: null,
      type: 'VARCHAR(255)',
      type_generic: 1,
      verbose_name: null,
      warning_markdown: null,
    },
  ],
  datasource_name: 'birth_names',
  description: null,
  granularity_sqla: 'ds',
  id: 2,
  main_dttm_col: 'ds',
  metrics: [
    {
      certification_details: null,
      certified_by: null,
      d3format: null,
      description: null,
      expression: 'COUNT(*)',
      id: 7,
      is_certified: false,
      metric_name: 'count',
      verbose_name: 'COUNT(*)',
      warning_markdown: '',
      warning_text: null,
    },
  ],
  name: 'public.birth_names',
  order_by_choices: [],
  owners: [
    {
      first_name: 'admin',
      id: 1,
      last_name: 'user',
      username: 'admin',
    },
  ],
  type: DatasourceType.Dataset,
  uid: '2__table',
  verbose_map: {},
};
