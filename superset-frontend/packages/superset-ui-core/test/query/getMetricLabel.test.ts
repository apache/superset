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
import { getMetricLabel } from '@superset-ui/core';

describe('getMetricLabel', () => {
  it('should handle predefined metric name', () => {
    expect(getMetricLabel('sum__num')).toEqual('sum__num');
  });

  it('should handle simple adhoc metrics', () => {
    expect(
      getMetricLabel({
        expressionType: 'SIMPLE',
        aggregate: 'AVG',
        column: {
          id: 5,
          type: 'BIGINT',
          columnName: 'sum_girls',
        },
      }),
    ).toEqual('AVG(sum_girls)');
  });

  it('should handle column_name in alternative field', () => {
    expect(
      getMetricLabel({
        expressionType: 'SIMPLE',
        aggregate: 'AVG',
        column: {
          id: 5,
          type: 'BIGINT',
          column_name: 'sum_girls',
        },
      }),
    ).toEqual('AVG(sum_girls)');
  });

  it('should handle SQL adhoc metrics', () => {
    expect(
      getMetricLabel({
        expressionType: 'SQL',
        sqlExpression: 'COUNT(sum_girls)',
      }),
    ).toEqual('COUNT(sum_girls)');
  });

  it('should handle adhoc metrics with custom labels', () => {
    expect(
      getMetricLabel({
        expressionType: 'SQL',
        label: 'foo',
        sqlExpression: 'COUNT(sum_girls)',
      }),
    ).toEqual('foo');
  });
});
