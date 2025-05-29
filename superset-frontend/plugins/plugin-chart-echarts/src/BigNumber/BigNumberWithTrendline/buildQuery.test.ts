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
import buildQuery from './buildQuery';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  getXAxisColumn: jest.fn(() => 'order_date'),
  isXAxisSet: jest.fn(() => true),
}));

jest.mock('@superset-ui/chart-controls', () => ({
  pivotOperator: jest.fn(() => ({ operation: 'pivot' })),
  aggregationOperator: jest.fn(formData => {
    if (formData.aggregation === 'LAST_VALUE' || !formData.aggregation) {
      return undefined;
    }
    return {
      operation: 'aggregation',
      options: { operator: formData.aggregation },
    };
  }),
  flattenOperator: jest.fn(() => ({ operation: 'flatten' })),
  resampleOperator: jest.fn(() => ({ operation: 'resample' })),
  rollingWindowOperator: jest.fn(() => ({ operation: 'rolling' })),
}));

describe('BigNumberWithTrendline buildQuery', () => {
  const baseFormData: QueryFormData = {
    datasource: '1__table',
    viz_type: 'big_number',
    metric: 'custom_metric',
    aggregation: null,
  };

  it('creates raw metric query when aggregation is null', () => {
    const queryContext = buildQuery({ ...baseFormData });
    const bigNumberQuery = queryContext.queries[1];

    expect(bigNumberQuery.post_processing).toEqual([{ operation: 'pivot' }]);
    expect(bigNumberQuery.is_timeseries).toBe(true);
  });

  it('adds aggregation operator when aggregation is "sum"', () => {
    const queryContext = buildQuery({ ...baseFormData, aggregation: 'sum' });
    const bigNumberQuery = queryContext.queries[1];

    expect(bigNumberQuery.post_processing).toEqual([
      { operation: 'pivot' },
      { operation: 'aggregation', options: { operator: 'sum' } },
    ]);
    expect(bigNumberQuery.is_timeseries).toBe(true);
  });

  it('skips aggregation when aggregation is LAST_VALUE', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      aggregation: 'LAST_VALUE',
    });
    const bigNumberQuery = queryContext.queries[1];

    expect(bigNumberQuery.post_processing).toEqual([{ operation: 'pivot' }]);
    expect(bigNumberQuery.is_timeseries).toBe(true);
  });

  it('always returns two queries', () => {
    const queryContext = buildQuery({ ...baseFormData });
    expect(queryContext.queries.length).toBe(2);
  });
});
