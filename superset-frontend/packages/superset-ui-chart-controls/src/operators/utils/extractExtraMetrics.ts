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
import {
  ensureIsArray,
  getMetricLabel,
  QueryFormData,
  QueryFormMetric,
} from '@superset-ui/core';

export function extractExtraMetrics(
  formData: QueryFormData,
): QueryFormMetric[] {
  const { groupby, timeseries_limit_metric, metrics } = formData;
  const extra_metrics: QueryFormMetric[] = [];
  const limitMetric = ensureIsArray(timeseries_limit_metric)[0];

  if (!(groupby || []).length && limitMetric) {
    const limitMetricLabel = getMetricLabel(limitMetric);
    const isLimitMetricInMetrics = metrics?.some(
      metric => getMetricLabel(metric) === limitMetricLabel,
    );

    // Add limit metric as extra if it's not already in display metrics
    // This ensures it's fetched for sorting but not displayed as a separate series
    if (!isLimitMetricInMetrics) {
      extra_metrics.push(limitMetric);
    }
  }
  return extra_metrics;
}
