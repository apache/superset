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

import { JsonObject } from '@superset-ui/core';
import { getFormDataWithDashboardContext } from './getFormDataWithDashboardContext';

const getExploreFormData = (overrides: JsonObject = {}) => ({
  adhoc_filters: [
    {
      clause: 'WHERE' as const,
      expressionType: 'SIMPLE' as const,
      operator: 'IN' as const,
      subject: 'gender',
      comparator: ['boys'],
      filterOptionName: '123',
    },
    {
      clause: 'WHERE' as const,
      expressionType: 'SQL' as const,
      operator: null,
      subject: null,
      comparator: null,
      sqlExpression: "name = 'John'",
      filterOptionName: '456',
    },
    {
      clause: 'WHERE' as const,
      expressionType: 'SQL' as const,
      operator: null,
      subject: null,
      comparator: null,
      sqlExpression: "city = 'Warsaw'",
      filterOptionName: '567',
    },
  ],
  adhoc_filters_b: [
    {
      clause: 'WHERE' as const,
      expressionType: 'SQL' as const,
      operator: null,
      subject: null,
      comparator: null,
      sqlExpression: "country = 'Poland'",
      filterOptionName: '789',
    },
  ],
  applied_time_extras: {},
  color_scheme: 'supersetColors',
  datasource: '2__table',
  granularity_sqla: 'ds',
  groupby: ['gender'],
  metric: {
    aggregate: 'SUM',
    column: {
      column_name: 'num',
      type: 'BIGINT',
    },
    expressionType: 'SIMPLE',
    label: 'Births',
  },
  slice_id: 46,
  time_range: '100 years ago : now',
  viz_type: 'pie',
  ...overrides,
});

const getDashboardFormData = (overrides: JsonObject = {}) => ({
  label_colors: {
    Girls: '#FF69B4',
    Boys: '#ADD8E6',
    girl: '#FF69B4',
    boy: '#ADD8E6',
  },
  shared_label_colors: {
    boy: '#ADD8E6',
    girl: '#FF69B4',
  },
  color_scheme: 'd3Category20b',
  extra_filters: [
    {
      col: '__time_range',
      op: '==',
      val: 'No filter',
    },
    {
      col: '__time_grain',
      op: '==',
      val: 'P1D',
    },
    {
      col: '__time_col',
      op: '==',
      val: 'ds',
    },
  ],
  extra_form_data: {
    filters: [
      {
        col: 'name',
        op: 'IN',
        val: ['Aaron'],
      },
      {
        col: 'num_boys',
        op: '<=',
        val: 10000,
      },
    ],
    granularity_sqla: 'ds',
    time_range: 'Last month',
    time_grain_sqla: 'PT1S',
  },
  dashboardId: 2,
  ...overrides,
});

const getExpectedResultFormData = (overrides: JsonObject = {}) => ({
  adhoc_filters: [
    {
      clause: 'WHERE',
      expressionType: 'SIMPLE',
      operator: 'IN',
      subject: 'gender',
      comparator: ['boys'],
      filterOptionName: '123',
    },
    {
      clause: 'WHERE' as const,
      expressionType: 'SQL' as const,
      operator: null,
      subject: null,
      comparator: null,
      sqlExpression: "name = 'John'",
      filterOptionName: '456',
    },
    {
      clause: 'WHERE' as const,
      expressionType: 'SQL' as const,
      operator: null,
      subject: null,
      comparator: null,
      sqlExpression: "city = 'Warsaw'",
      filterOptionName: '567',
    },
    {
      clause: 'WHERE',
      expressionType: 'SIMPLE',
      operator: 'IN',
      subject: 'name',
      comparator: ['Aaron'],
      isExtra: true,
      filterOptionName: expect.any(String),
    },
    {
      clause: 'WHERE',
      expressionType: 'SIMPLE',
      operator: '<=',
      subject: 'num_boys',
      comparator: 10000,
      isExtra: true,
      filterOptionName: expect.any(String),
    },
  ],
  adhoc_filters_b: [
    {
      clause: 'WHERE' as const,
      expressionType: 'SQL' as const,
      operator: null,
      subject: null,
      comparator: null,
      sqlExpression: "country = 'Poland'",
      filterOptionName: expect.any(String),
    },
    {
      clause: 'WHERE',
      expressionType: 'SIMPLE',
      operator: 'IN',
      subject: 'name',
      comparator: ['Aaron'],
      isExtra: true,
      filterOptionName: expect.any(String),
    },
    {
      clause: 'WHERE',
      expressionType: 'SIMPLE',
      operator: '<=',
      subject: 'num_boys',
      comparator: 10000,
      isExtra: true,
      filterOptionName: expect.any(String),
    },
  ],
  applied_time_extras: {
    __time_grain: 'P1D',
    __time_col: 'ds',
  },
  color_scheme: 'd3Category20b',
  datasource: '2__table',
  granularity_sqla: 'ds',
  groupby: ['gender'],
  metric: {
    aggregate: 'SUM',
    column: {
      column_name: 'num',
      type: 'BIGINT',
    },
    expressionType: 'SIMPLE',
    label: 'Births',
  },
  slice_id: 46,
  time_range: 'Last month',
  viz_type: 'pie',
  label_colors: {
    Girls: '#FF69B4',
    Boys: '#ADD8E6',
    girl: '#FF69B4',
    boy: '#ADD8E6',
  },
  shared_label_colors: {
    boy: '#ADD8E6',
    girl: '#FF69B4',
  },
  extra_filters: [
    {
      col: '__time_range',
      op: '==',
      val: 'No filter',
    },
    {
      col: '__time_grain',
      op: '==',
      val: 'P1D',
    },
    {
      col: '__time_col',
      op: '==',
      val: 'ds',
    },
  ],
  extra_form_data: {
    filters: [
      {
        col: 'name',
        op: 'IN',
        val: ['Aaron'],
      },
      {
        col: 'num_boys',
        op: '<=',
        val: 10000,
      },
    ],
    granularity_sqla: 'ds',
    time_range: 'Last month',
    time_grain_sqla: 'PT1S',
  },
  dashboardId: 2,
  time_grain_sqla: 'PT1S',
  granularity: 'ds',
  extras: {
    time_grain_sqla: 'PT1S',
  },
  ...overrides,
});

it('merges dashboard context form data with explore form data', () => {
  const fullFormData = getFormDataWithDashboardContext(
    getExploreFormData(),
    getDashboardFormData(),
  );
  expect(fullFormData).toEqual(getExpectedResultFormData());
});
