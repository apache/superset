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
import { ColumnMeta } from '@superset-ui/chart-controls';
import { GenericDataType } from '@superset-ui/core';

export const columns: ColumnMeta[] = [
  {
    column_name: 'bootcamp_attend',
    description: null,
    expression: null,
    filterable: true,
    groupby: true,
    id: 516,
    is_dttm: false,
    python_date_format: null,
    type: 'DOUBLE',
    type_generic: GenericDataType.NUMERIC,
    verbose_name: null,
  },
  {
    column_name: 'calc_first_time_dev',
    description: null,
    expression:
      'CASE WHEN is_first_dev_job = 0 THEN "No" WHEN is_first_dev_job = 1 THEN "Yes" END',
    filterable: true,
    groupby: true,
    id: 477,
    is_dttm: false,
    python_date_format: null,
    type: 'VARCHAR',
    type_generic: GenericDataType.STRING,
    verbose_name: null,
  },
  {
    column_name: 'aaaaaaaaaaa',
    description: null,
    expression: null,
    filterable: true,
    groupby: true,
    id: 516,
    is_dttm: false,
    python_date_format: null,
    type: 'INT',
    type_generic: GenericDataType.NUMERIC,
    verbose_name: null,
  },
];

const metricsFiltered = {
  certified: [
    {
      certification_details: null,
      certified_by: 'user',
      d3format: null,
      description: null,
      expression: '',
      id: 56,
      is_certified: true,
      metric_name: 'metric_end_certified',
      verbose_name: '',
      warning_text: null,
    },
  ],
  uncertified: [
    {
      certification_details: null,
      certified_by: null,
      d3format: null,
      description: null,
      expression: '',
      id: 57,
      is_certified: false,
      metric_name: 'metric_end',
      verbose_name: '',
      warning_text: null,
    },
  ],
};

export const metrics = [
  ...metricsFiltered.certified,
  ...metricsFiltered.uncertified,
];
