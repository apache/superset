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
import { QueryFormData } from '@superset-ui/core';
import buildQuery from '../../../src/BigNumber/BigNumberPeriodOverPeriod/buildQuery';

describe('BigNumberPeriodOverPeriod buildQuery', () => {
  const baseFormData: QueryFormData = {
    datasource: '1__table',
    viz_type: 'pop_kpi',
    metric: 'count',
    cols: [],
    adhoc_filters: [
      {
        clause: 'WHERE',
        subject: 'order_date',
        operator: 'TEMPORAL_RANGE',
        comparator: '2003-07-01 : 2004-01-01',
        expressionType: 'SIMPLE',
      },
    ],
  };

  test('flows extra_form_data.time_compare override into time_offsets', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      extra_form_data: { time_compare: '1 year ago' },
    });

    expect(queryContext.queries[0].time_offsets).toEqual(['1 year ago']);
  });

  test('requests offsets from the override even without the chart time_compare control', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      time_compare: undefined,
      extra_form_data: { time_compare: '1 year ago' },
    });

    expect(queryContext.queries[0].time_offsets).toEqual(['1 year ago']);
  });

  test('does not duplicate the offset when it already matches time_compare', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      time_compare: ['1 year ago'],
      extra_form_data: { time_compare: '1 year ago' },
    });

    expect(queryContext.queries[0].time_offsets).toEqual(['1 year ago']);
  });

  test('omits time_offsets when neither the control nor the override is set', () => {
    const queryContext = buildQuery(baseFormData);

    expect(queryContext.queries[0].time_offsets).toEqual([]);
  });
});
