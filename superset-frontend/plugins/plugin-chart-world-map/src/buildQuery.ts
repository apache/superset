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

export interface WorldMapFormData extends QueryFormData {
  entity?: string;
  metric?: QueryFormMetric;
  secondary_metric?: QueryFormMetric;
  sort_by_metric?: boolean;
}

/**
 * Replicates the query the legacy WorldMapViz (superset/viz.py) used to build:
 * group by the entity (country) column, request the primary metric plus the
 * bubble-size metric when it is distinct, and order by the primary metric
 * when "sort by metric" is enabled.
 */
export default function buildQuery(formData: WorldMapFormData) {
  const { entity, metric, secondary_metric, sort_by_metric } = formData;
  const metrics: QueryFormMetric[] = metric ? [metric] : [];
  if (
    metric &&
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
      ...(sort_by_metric && metric ? { orderby: [[metric, false]] } : {}),
    },
  ]);
}
