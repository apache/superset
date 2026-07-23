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
import { JsonObject, VizType } from '@superset-ui/core';

export const getExploreFormData = (overrides: JsonObject = {}) => ({
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
    {
      clause: 'WHERE' as const,
      expressionType: 'SIMPLE' as const,
      operator: 'TEMPORAL_RANGE' as const,
      subject: 'ds',
      comparator: 'No filter',
      filterOptionName: '678',
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
  viz_type: VizType.Pie,
  ...overrides,
});
