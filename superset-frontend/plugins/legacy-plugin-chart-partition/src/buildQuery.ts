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
  ensureIsArray,
  getMetricLabel,
  QueryFormData,
  QueryFormMetric,
  QueryFormOrderBy,
} from '@superset-ui/core';

/**
 * Mirrors the legacy PartitionViz.query_obj: a query grouped by all the
 * hierarchy levels, timeseries only when the time-series option needs
 * per-timestamp data, with the legacy sort-metric handling.
 */
export default function buildQuery(formData: QueryFormData) {
  const { time_series_option, timeseries_limit_metric, order_desc } = formData;
  return buildQueryContext(formData, baseQueryObject => {
    let metrics: QueryFormMetric[] = ensureIsArray(baseQueryObject.metrics);
    const orderby: QueryFormOrderBy[] = [];
    const sortByMetric = ensureIsArray(
      timeseries_limit_metric as QueryFormMetric | QueryFormMetric[],
    )[0];
    if (sortByMetric) {
      const sortByLabel = getMetricLabel(sortByMetric);
      if (!metrics.some(metric => getMetricLabel(metric) === sortByLabel)) {
        metrics = [...metrics, sortByMetric];
      }
      if (order_desc) {
        orderby.push([sortByMetric, !order_desc]);
      }
    }
    return [
      {
        ...baseQueryObject,
        metrics,
        is_timeseries: (time_series_option ?? 'not_time') !== 'not_time',
        orderby: orderby.length > 0 ? orderby : undefined,
      },
    ];
  });
}
