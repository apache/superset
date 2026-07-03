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
  buildQueryContext,
  getMetricLabel,
  QueryFormData,
  QueryFormMetric,
} from '@superset-ui/core';

/**
 * Mirrors the legacy WorldMapViz.query_obj: one query grouped by the
 * country entity column selecting the main metric (and the secondary
 * bubble-size metric when set), ordered by the main metric when
 * sort_by_metric is on.
 */
export default function buildQuery(formData: QueryFormData) {
  const { entity, metric, secondary_metric, sort_by_metric } = formData;
  const metrics: QueryFormMetric[] = metric ? [metric] : [];
  if (
    secondary_metric &&
    getMetricLabel(secondary_metric) !== getMetricLabel(metric)
  ) {
    metrics.push(secondary_metric);
  }
  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      columns: entity ? [entity] : [],
      metrics,
      orderby: sort_by_metric && metric ? [[metric, false]] : undefined,
    },
  ]);
}
