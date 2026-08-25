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
import { QueryFormMetric } from '@superset-ui/core';
import { getTotalsMetrics } from './getTotalsMetrics';

const simpleMetric = (aggregate: string): QueryFormMetric =>
  ({
    label: 'simple_metric',
    expressionType: 'SIMPLE',
    column: { column_name: 'col' },
    aggregate,
  }) as QueryFormMetric;

const sqlMetric = (): QueryFormMetric =>
  ({
    label: 'sql_metric',
    expressionType: 'SQL',
    sqlExpression: 'SUM(col) / COUNT(*)',
  }) as QueryFormMetric;

const savedMetric = (): QueryFormMetric => 'saved_metric';

describe('getTotalsMetrics', () => {
  test('overrides the aggregate on simple (adhoc) metrics', () => {
    const [result] = getTotalsMetrics([simpleMetric('SUM')], 'AVG');
    expect(result).toEqual(
      expect.objectContaining({ aggregate: 'AVG', expressionType: 'SIMPLE' }),
    );
  });

  test('is a no-op when the simple metric already uses the requested aggregate', () => {
    const [result] = getTotalsMetrics([simpleMetric('SUM')], 'SUM');
    expect(result).toEqual(
      expect.objectContaining({ aggregate: 'SUM', expressionType: 'SIMPLE' }),
    );
  });

  test('leaves custom SQL metrics unchanged', () => {
    const metric = sqlMetric();
    const [result] = getTotalsMetrics([metric], 'AVG');
    expect(result).toBe(metric);
  });

  test('leaves saved (string) metrics unchanged', () => {
    const metric = savedMetric();
    const [result] = getTotalsMetrics([metric], 'AVG');
    expect(result).toBe(metric);
  });

  test('handles a mix of metric types, only rewriting simple metrics', () => {
    const metrics = [simpleMetric('SUM'), sqlMetric(), savedMetric()];
    const result = getTotalsMetrics(metrics, 'AVG');

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(expect.objectContaining({ aggregate: 'AVG' }));
    expect(result[1]).toBe(metrics[1]);
    expect(result[2]).toBe(metrics[2]);
  });

  test('returns an empty array when given no metrics', () => {
    expect(getTotalsMetrics([], 'AVG')).toEqual([]);
  });
});
