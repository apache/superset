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
 * Mirrors the query the legacy `para` viz built server-side: one query
 * grouped by `series` selecting all metrics (including the secondary
 * "color" metric, aliased into `metrics` by extractQueryFields). The
 * sort metric is added to the select list so its ordering is visible in
 * the result, and ordering is applied when `order_desc` is set.
 */
export default function buildQuery(formData: QueryFormData) {
  const { timeseries_limit_metric, order_desc } = formData;
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
        // own the ordering entirely: the legacy pipeline ignored residual
        // orderby fields (e.g. order_by_cols left over from other viz types)
        orderby: orderby.length > 0 ? orderby : undefined,
      },
    ];
  });
}
