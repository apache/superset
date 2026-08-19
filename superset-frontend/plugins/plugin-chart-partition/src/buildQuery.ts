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
  QueryFormData,
  QueryFormMetric,
} from '@superset-ui/core';
import { buildSortMetricOrderby } from '@superset-ui/chart-controls';

/**
 * Mirrors the legacy PartitionViz.query_obj (via NVD3TimeSeriesViz): a
 * query grouped by all the hierarchy levels, timeseries only when the
 * time-series option needs per-timestamp data, ordered by the sort
 * metric (falling back to the first selected metric) ascending unless
 * order_desc.
 */
export default function buildQuery(formData: QueryFormData) {
  const { time_series_option, timeseries_limit_metric, order_desc } = formData;
  return buildQueryContext(formData, baseQueryObject => {
    const { metrics, orderby } = buildSortMetricOrderby({
      metrics: ensureIsArray(baseQueryObject.metrics) as QueryFormMetric[],
      timeseriesLimitMetric: timeseries_limit_metric,
      order_desc,
      fallbackToFirstMetric: true,
    });
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
