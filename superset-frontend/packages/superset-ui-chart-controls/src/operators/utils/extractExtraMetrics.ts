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
  getMetricLabel,
  QueryFormData,
  QueryFormMetric,
} from '@superset-ui/core';

export function extractExtraMetrics(
  formData: QueryFormData,
): QueryFormMetric[] {
  const { groupby, timeseries_limit_metric, x_axis_sort } = formData;
  const extra_metrics: QueryFormMetric[] = [];
  if (
    !(groupby || []).length &&
    timeseries_limit_metric &&
    getMetricLabel(timeseries_limit_metric) === x_axis_sort
  ) {
    extra_metrics.push(timeseries_limit_metric);
  }
  return extra_metrics;
}
