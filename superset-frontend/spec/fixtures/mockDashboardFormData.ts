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
/* eslint-disable theme-colors/no-literal-colors */
import { JsonObject } from '@superset-ui/core';

export const getDashboardFormData = (overrides: JsonObject = {}) => ({
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
      {
        col: {
          sqlExpression: 'totally viable sql expression',
          expressionType: 'SQL',
          label: 'My column',
        },
        op: 'IN',
        val: ['Value1', 'Value2'],
      },
    ],
    granularity_sqla: 'ds',
    time_range: 'Last month',
    time_grain_sqla: 'PT1S',
  },
  dashboardId: 2,
  ...overrides,
});
