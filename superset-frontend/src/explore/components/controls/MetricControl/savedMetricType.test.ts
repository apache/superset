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
import { savedMetricType } from './savedMetricType';

test('savedMetricType exports the correct type structure', () => {
  // Type assertion test - if this compiles without errors,
  // the type structure is correct
  const validMetric: savedMetricType = {
    metric_name: 'test_metric',
    verbose_name: 'Test Metric',
    expression: 'SUM(column)',
  };

  expect(validMetric.metric_name).toBe('test_metric');
  expect(validMetric.verbose_name).toBe('Test Metric');
  expect(validMetric.expression).toBe('SUM(column)');
});

test('savedMetricType allows optional verbose_name', () => {
  // Test that verbose_name is optional
  const validMetricMinimal: savedMetricType = {
    metric_name: 'minimal_metric',
    expression: 'COUNT(*)',
  };

  expect(validMetricMinimal.metric_name).toBe('minimal_metric');
  expect(validMetricMinimal.expression).toBe('COUNT(*)');
  expect(validMetricMinimal.verbose_name).toBeUndefined();
});
