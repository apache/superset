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
import buildQuery from '../../src/Bubble/buildQuery';

describe('Bubble buildQuery', () => {
  const formData = {
    datasource: '1__table',
    viz_type: 'echarts_bubble',
    entity: 'customer_name',
    x: 'count',
    y: {
      aggregate: 'sum',
      column: {
        column_name: 'price_each',
      },
      expressionType: 'simple',
      label: 'SUM(price_each)',
    },
    size: {
      aggregate: 'sum',
      column: {
        column_name: 'sales',
      },
      expressionType: 'simple',
      label: 'SUM(sales)',
    },
  };

  it('Should build query without dimension', () => {
    const queryContext = buildQuery(formData);
    const [query] = queryContext.queries;
    expect(query.columns).toEqual(['customer_name']);
    expect(query.metrics).toEqual([
      'count',
      {
        aggregate: 'sum',
        column: {
          column_name: 'price_each',
        },
        expressionType: 'simple',
        label: 'SUM(price_each)',
      },
      {
        aggregate: 'sum',
        column: {
          column_name: 'sales',
        },
        expressionType: 'simple',
        label: 'SUM(sales)',
      },
    ]);
  });
  it('Should build query with dimension', () => {
    const queryContext = buildQuery({ ...formData, series: 'state' });
    const [query] = queryContext.queries;
    expect(query.columns).toEqual(['customer_name', 'state']);
    expect(query.metrics).toEqual([
      'count',
      {
        aggregate: 'sum',
        column: {
          column_name: 'price_each',
        },
        expressionType: 'simple',
        label: 'SUM(price_each)',
      },
      {
        aggregate: 'sum',
        column: {
          column_name: 'sales',
        },
        expressionType: 'simple',
        label: 'SUM(sales)',
      },
    ]);
  });
});
