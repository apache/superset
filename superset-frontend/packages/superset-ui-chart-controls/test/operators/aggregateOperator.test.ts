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
import { QueryObject, SqlaFormData, VizType } from '@superset-ui/core';
import { aggregationOperator } from '@superset-ui/chart-controls';

describe('aggregationOperator', () => {
  const formData: SqlaFormData = {
    metrics: [
      'count(*)',
      { label: 'sum(val)', expressionType: 'SQL', sqlExpression: 'sum(val)' },
    ],
    time_range: '2015 : 2016',
    granularity: 'month',
    datasource: 'foo',
    viz_type: VizType.Table,
  };

  const queryObject: QueryObject = {
    metrics: [
      'count(*)',
      { label: 'sum(val)', expressionType: 'SQL', sqlExpression: 'sum(val)' },
    ],
    time_range: '2015 : 2016',
    granularity: 'month',
  };

  test('should return undefined for LAST_VALUE aggregation', () => {
    const formDataWithLastValue = {
      ...formData,
      aggregation: 'LAST_VALUE',
    };

    expect(
      aggregationOperator(formDataWithLastValue, queryObject),
    ).toBeUndefined();
  });

  test('should return undefined when metrics is empty', () => {
    const queryObjectWithoutMetrics = {
      ...queryObject,
      metrics: [],
    };

    const formDataWithSum = {
      ...formData,
      aggregation: 'sum',
    };

    expect(
      aggregationOperator(formDataWithSum, queryObjectWithoutMetrics),
    ).toBeUndefined();
  });

  test('should apply sum aggregation to all metrics', () => {
    const formDataWithSum = {
      ...formData,
      aggregation: 'sum',
    };

    expect(aggregationOperator(formDataWithSum, queryObject)).toEqual({
      operation: 'aggregate',
      options: {
        groupby: [],
        aggregates: {
          'count(*)': {
            operator: 'sum',
            column: 'count(*)',
          },
          'sum(val)': {
            operator: 'sum',
            column: 'sum(val)',
          },
        },
      },
    });
  });

  test('should apply mean aggregation to all metrics', () => {
    const formDataWithMean = {
      ...formData,
      aggregation: 'mean',
    };

    expect(aggregationOperator(formDataWithMean, queryObject)).toEqual({
      operation: 'aggregate',
      options: {
        groupby: [],
        aggregates: {
          'count(*)': {
            operator: 'mean',
            column: 'count(*)',
          },
          'sum(val)': {
            operator: 'mean',
            column: 'sum(val)',
          },
        },
      },
    });
  });

  test('should use default aggregation when not specified', () => {
    expect(aggregationOperator(formData, queryObject)).toBeUndefined();
  });
});
