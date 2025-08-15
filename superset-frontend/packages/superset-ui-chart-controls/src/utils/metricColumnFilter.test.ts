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

import { QueryFormMetric, SqlaFormData } from '@superset-ui/core';
import {
  shouldSkipMetricColumn,
  isRegularMetric,
  isPercentMetric,
} from './metricColumnFilter';

const createMetric = (label: string): QueryFormMetric =>
  ({
    label,
    expressionType: 'SIMPLE',
    column: { column_name: label },
    aggregate: 'SUM',
  }) as QueryFormMetric;

describe('metricColumnFilter', () => {
  const createFormData = (
    metrics: string[],
    percentMetrics: string[],
  ): SqlaFormData =>
    ({
      datasource: 'test_datasource',
      viz_type: 'table',
      metrics: metrics.map(createMetric),
      percent_metrics: percentMetrics.map(createMetric),
    }) as SqlaFormData;

  describe('shouldSkipMetricColumn', () => {
    it('should skip unprefixed percent metric columns if prefixed version exists', () => {
      const colnames = ['metric1', '%metric1'];
      const formData = createFormData([], ['metric1']);

      const result = shouldSkipMetricColumn({
        colname: 'metric1',
        colnames,
        formData,
      });

      expect(result).toBe(true);
    });

    it('should not skip if column is also a regular metric', () => {
      const colnames = ['metric1', '%metric1'];
      const formData = createFormData(['metric1'], ['metric1']);

      const result = shouldSkipMetricColumn({
        colname: 'metric1',
        colnames,
        formData,
      });

      expect(result).toBe(false);
    });

    it('should not skip if column starts with %', () => {
      const colnames = ['%metric1'];
      const formData = createFormData(['metric1'], []);

      const result = shouldSkipMetricColumn({
        colname: '%metric1',
        colnames,
        formData,
      });

      expect(result).toBe(false);
    });

    it('should not skip if no prefixed version exists', () => {
      const colnames = ['metric1'];
      const formData = createFormData([], ['metric1']);

      const result = shouldSkipMetricColumn({
        colname: 'metric1',
        colnames,
        formData,
      });

      expect(result).toBe(false);
    });
  });

  describe('isRegularMetric', () => {
    it('should return true for regular metrics', () => {
      const formData = createFormData(['metric1', 'metric2'], []);
      expect(isRegularMetric('metric1', formData)).toBe(true);
      expect(isRegularMetric('metric2', formData)).toBe(true);
    });

    it('should return false for non-metrics', () => {
      const formData = createFormData(['metric1'], []);
      expect(isRegularMetric('non_metric', formData)).toBe(false);
    });

    it('should return false for percentage metrics', () => {
      const formData = createFormData([], ['percent_metric1']);
      expect(isRegularMetric('percent_metric1', formData)).toBe(false);
    });
  });

  describe('isPercentMetric', () => {
    it('should return true for percentage metrics', () => {
      const formData = createFormData([], ['percent_metric1']);
      expect(isPercentMetric('%percent_metric1', formData)).toBe(true);
    });

    it('should return false for non-percentage metrics', () => {
      const formData = createFormData(['regular_metric'], []);
      expect(isPercentMetric('regular_metric', formData)).toBe(false);
    });

    it('should return false for regular metrics', () => {
      const formData = createFormData(['metric1'], []);
      expect(isPercentMetric('metric1', formData)).toBe(false);
    });
  });
});
