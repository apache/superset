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
import { ColumnType } from 'src/query/Column';
import {
  AdhocMetric, Aggregate, ExpressionType, LABEL_MAX_LENGTH, Metrics,
} from 'src/query/Metric';

describe('Metrics', () => {
  let metrics: Metrics;
  const formData = {
    datasource: '5__table',
    granularity_sqla: 'ds',
  };

  it('should build metrics for built-in metric keys', () => {
    metrics = new Metrics({
      ...formData,
      metric: 'sum__num',
    });
    expect(metrics.getMetrics()).toEqual([{label: 'sum__num'}]);
    expect(metrics.getLabels()).toEqual(['sum__num']);
  });

  it('should build metrics for simple adhoc metrics', () => {
    const adhocMetric: AdhocMetric = {
      aggregate: Aggregate.AVG,
      column: {
        columnName: 'sum_girls',
        id: 5,
        type: ColumnType.BIGINT,
      },
      expressionType: ExpressionType.SIMPLE,
    };
    metrics = new Metrics({
      ...formData,
      metric: adhocMetric,
    });
    expect(metrics.getMetrics()).toEqual([{
      aggregate: 'AVG',
      column: {
        columnName: 'sum_girls',
        id: 5,
        type: ColumnType.BIGINT,
      },
      expressionType: 'SIMPLE',
      label: 'AVG(sum_girls)',
    }]);
    expect(metrics.getLabels()).toEqual(['AVG(sum_girls)']);
  });

  it('should build metrics for SQL adhoc metrics', () => {
    const adhocMetric: AdhocMetric = {
      expressionType: ExpressionType.SQL,
      sqlExpression: 'COUNT(sum_girls)',
    };
    metrics = new Metrics({
      ...formData,
      metric: adhocMetric,
    });
    expect(metrics.getMetrics()).toEqual([{
      expressionType: 'SQL',
      label: 'COUNT(sum_girls)',
      sqlExpression: 'COUNT(sum_girls)',
    }]);
    expect(metrics.getLabels()).toEqual(['COUNT(sum_girls)']);
  });

  it('should build metrics for adhoc metrics with custom labels', () => {
    const adhocMetric: AdhocMetric = {
      expressionType: ExpressionType.SQL,
      label: 'foo',
      sqlExpression: 'COUNT(sum_girls)',
    };
    metrics = new Metrics({
      ...formData,
      metric: adhocMetric,
    });
    expect(metrics.getMetrics()).toEqual([{
      expressionType: 'SQL',
      label: 'foo',
      sqlExpression: 'COUNT(sum_girls)',
    }]);
    expect(metrics.getLabels()).toEqual(['foo']);
  });

  it('should truncate labels if they are too long', () => {
    const adhocMetric: AdhocMetric = {
      expressionType: ExpressionType.SQL,
      sqlExpression: 'COUNT(verrrrrrrrry_loooooooooooooooooooooong_string)',
    };
    metrics = new Metrics({
      ...formData,
      metric: adhocMetric,
    });
    expect(metrics.getLabels()[0].length).toBeLessThanOrEqual(LABEL_MAX_LENGTH);
  });
});
