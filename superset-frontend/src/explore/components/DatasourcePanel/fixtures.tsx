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
import { GenericDataType } from '@apache-superset/core/api/core';

export const columns = [
  {
    column_name: 'bootcamp_attend',
    description: null,
    expression: null,
    filterable: true,
    groupby: true,
    id: 516,
    uuid: '516',
    is_dttm: false,
    python_date_format: null,
    type: 'DOUBLE',
    type_generic: GenericDataType.Numeric,
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
    uuid: '477',
    is_dttm: false,
    python_date_format: null,
    type: 'VARCHAR',
    type_generic: GenericDataType.String,
    verbose_name: null,
  },
  {
    column_name: 'aaaaaaaaaaa',
    description: null,
    expression: null,
    filterable: true,
    groupby: true,
    id: 517,
    uuid: '517',
    is_dttm: false,
    python_date_format: null,
    type: 'INT',
    type_generic: GenericDataType.Numeric,
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
      uuid: '56',
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
      uuid: '57',
      is_certified: false,
      metric_name: 'metric_end',
      verbose_name: '',
      warning_text: null,
    },
  ],
};

export const columnsUnsorted = [
  {
    column_name: 'ccc',
    description: null,
    expression: null,
    filterable: true,
    groupby: true,
    id: 100,
    uuid: '100',
    is_dttm: false,
    python_date_format: null,
    type: 'VARCHAR',
    type_generic: GenericDataType.String,
    verbose_name: 'ccc',
  },
  {
    column_name: 'aaa',
    description: null,
    expression: null,
    filterable: true,
    groupby: true,
    id: 101,
    uuid: '101',
    is_dttm: false,
    python_date_format: null,
    type: 'DOUBLE',
    type_generic: GenericDataType.Numeric,
    verbose_name: 'Www',
  },
  {
    column_name: 'Cbb',
    description: null,
    expression: null,
    filterable: true,
    groupby: true,
    id: 102,
    uuid: '102',
    is_dttm: false,
    python_date_format: null,
    type: 'INT',
    type_generic: GenericDataType.Numeric,
    verbose_name: null,
  },
  {
    column_name: 'BBB (has empty verbose_name)',
    description: null,
    expression: null,
    filterable: true,
    groupby: true,
    id: 102,
    uuid: '102',
    is_dttm: false,
    python_date_format: null,
    type: 'INT',
    type_generic: GenericDataType.Numeric,
    verbose_name: '',
  },
  {
    column_name: 'yyy',
    is_certified: 1,
    description: null,
    expression: null,
    filterable: true,
    groupby: true,
    id: 103,
    uuid: '103',
    is_dttm: false,
    python_date_format: null,
    type: 'INT',
    type_generic: GenericDataType.Numeric,
    verbose_name: 'yyy (certified)',
  },
  {
    column_name: 'Cdd',
    description: null,
    expression: null,
    filterable: true,
    groupby: true,
    id: 104,
    uuid: '104',
    is_dttm: false,
    python_date_format: null,
    type: 'INT',
    type_generic: GenericDataType.Numeric,
    verbose_name: null,
  },
];

const metricsFilteredUnsorted = {
  certified: [
    {
      certification_details: null,
      certified_by: 'user',
      d3format: null,
      description: null,
      expression: '',
      id: 59,
      uuid: '59',
      is_certified: true,
      metric_name: 'ee (certified)',
      warning_text: null,
    },
  ],
  uncertified: [
    {
      certification_details: null,
      d3format: null,
      description: null,
      expression: '',
      id: 56,
      uuid: '56',
      is_certified: false,
      metric_name: 'dd',
      warning_text: null,
    },
    {
      certification_details: null,
      d3format: null,
      description: null,
      expression: '',
      id: 57,
      uuid: '57',
      is_certified: false,
      metric_name: 'ee',
      verbose_name: 'aa',
      warning_text: null,
    },
    {
      certification_details: null,
      d3format: null,
      description: null,
      expression: '',
      id: 57,
      uuid: '57',
      is_certified: false,
      metric_name: 'cc (has empty verbose_name)',
      verbose_name: '',
      warning_text: null,
    },
    {
      certification_details: null,
      d3format: null,
      description: null,
      expression: '',
      id: 58,
      uuid: '58',
      is_certified: false,
      metric_name: 'bb',
      warning_text: null,
    },
  ],
};

export const metrics = [
  ...metricsFiltered.certified,
  ...metricsFiltered.uncertified,
];

export const metricsUnsorted = [
  ...metricsFilteredUnsorted.certified,
  ...metricsFilteredUnsorted.uncertified,
];
