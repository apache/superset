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
import { ensureIsArray, getMetricLabel } from '@superset-ui/core';
import type { QueryFormMetric, QueryFormOrderBy } from '@superset-ui/core';

export interface BuildSortMetricOrderbyConfig {
  /** The query's already-resolved metrics list. */
  metrics: QueryFormMetric[];
  /** The raw `timeseries_limit_metric` form-data value (single or multi). */
  timeseriesLimitMetric?: QueryFormMetric | QueryFormMetric[] | null;
  order_desc?: boolean;
  /**
   * Falls back to the first selected metric when no sort metric is set.
   * Charts ported from a legacy viz whose query_obj always had a sort
   * metric (defaulting to the first one) should set this; charts whose
   * legacy query_obj left ordering absent without one should not.
   */
  fallbackToFirstMetric?: boolean;
  /**
   * When true, only order when `order_desc` is set (matching legacy vizzes
   * whose query_obj left the result unordered unless the operator asked
   * for descending). When false, always order (ascending unless
   * order_desc), matching legacy vizzes that ordered unconditionally.
   */
  orderOnlyWhenDesc?: boolean;
}

export interface SortMetricOrderby {
  /** `metrics`, with the sort metric appended if it wasn't already selected. */
  metrics: QueryFormMetric[];
  orderby: QueryFormOrderBy[];
}

/**
 * Resolves a chart's sort metric and builds the corresponding query_obj
 * `orderby`, appending the sort metric to `metrics` if it isn't already
 * selected (so its value is present in the result to sort by). Several
 * charts ported from the legacy chart-data pipeline share this exact
 * shape with only the fallback/gating policy differing per their own
 * legacy `query_obj` behavior -- see `fallbackToFirstMetric` and
 * `orderOnlyWhenDesc`.
 */
export function buildSortMetricOrderby({
  metrics,
  timeseriesLimitMetric,
  order_desc: orderDesc,
  fallbackToFirstMetric = false,
  orderOnlyWhenDesc = false,
}: BuildSortMetricOrderbyConfig): SortMetricOrderby {
  const sortByMetric =
    ensureIsArray(timeseriesLimitMetric)[0] ??
    (fallbackToFirstMetric ? metrics[0] : undefined);

  if (!sortByMetric) {
    return { metrics, orderby: [] };
  }

  const sortByLabel = getMetricLabel(sortByMetric);
  const nextMetrics = metrics.some(
    metric => getMetricLabel(metric) === sortByLabel,
  )
    ? metrics
    : [...metrics, sortByMetric];

  const shouldOrder = orderOnlyWhenDesc ? Boolean(orderDesc) : true;

  return {
    metrics: nextMetrics,
    orderby: shouldOrder ? [[sortByMetric, !orderDesc]] : [],
  };
}
