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
import buildQuery from './buildQuery';

describe('buildQuery', () => {
  test('builds query with date range filter', () => {
    const formData = {
      datasource: 'table__1',
      groupby: ['order_date'],
      controlType: 'daterange',
      granularitySqla: 'order_date',
      dateRange: ['2024-01-01', '2024-12-31'],
    };

    const result = buildQuery(formData, {
      ownState: {},
    });

    expect(result.queries[0].filters).toHaveLength(2);
    expect(result.queries[0].filters[0]).toEqual({
      col: 'order_date',
      op: '>=',
      val: '2024-01-01',
    });
    expect(result.queries[0].filters[1]).toEqual({
      col: 'order_date',
      op: '<=',
      val: '2024-12-31',
    });
  });

  test('builds query without date range', () => {
    const formData = {
      datasource: 'table__1',
      groupby: ['order_date'],
      controlType: 'date',
      granularitySqla: 'order_date',
    };

    const result = buildQuery(formData, {
      ownState: {},
    });

    expect(result.queries[0].filters).toHaveLength(0);
  });

  test('builds query with partial date range', () => {
    const formData = {
      datasource: 'table__1',
      groupby: ['order_date'],
      controlType: 'daterange',
      granularitySqla: 'order_date',
      dateRange: ['2024-01-01'],
    };

    const result = buildQuery(formData, {
      ownState: {},
    });

    expect(result.queries[0].filters).toHaveLength(0);
  });
});
