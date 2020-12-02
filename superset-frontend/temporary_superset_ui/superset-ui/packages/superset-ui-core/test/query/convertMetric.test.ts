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
import { ColumnType, convertMetric } from '@superset-ui/core/src/query';

describe('convertMetric', () => {
  it('should handle string metric name', () => {
    expect(convertMetric('sum__num')).toEqual({ label: 'sum__num' });
  });

  it('should handle simple adhoc metrics', () => {
    expect(
      convertMetric({
        expressionType: 'SIMPLE',
        aggregate: 'AVG',
        column: {
          columnName: 'sum_girls',
          id: 5,
          type: ColumnType.BIGINT,
        },
      }),
    ).toEqual({
      aggregate: 'AVG',
      column: {
        columnName: 'sum_girls',
        id: 5,
        type: ColumnType.BIGINT,
      },
      expressionType: 'SIMPLE',
      label: 'AVG(sum_girls)',
    });
  });

  it('should handle SQL adhoc metrics', () => {
    expect(
      convertMetric({
        expressionType: 'SQL',
        sqlExpression: 'COUNT(sum_girls)',
      }),
    ).toEqual({
      expressionType: 'SQL',
      label: 'COUNT(sum_girls)',
      sqlExpression: 'COUNT(sum_girls)',
    });
  });

  it('should handle adhoc metrics with custom labels', () => {
    expect(
      convertMetric({
        expressionType: 'SQL',
        label: 'foo',
        sqlExpression: 'COUNT(sum_girls)',
      }),
    ).toEqual({
      expressionType: 'SQL',
      label: 'foo',
      sqlExpression: 'COUNT(sum_girls)',
    });
  });
});
