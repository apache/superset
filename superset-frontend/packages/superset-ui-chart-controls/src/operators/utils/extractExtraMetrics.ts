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
import { SortSeriesType } from '../../types';

export function extractExtraMetrics(
  formData: QueryFormData,
): QueryFormMetric[] {
  const { timeseries_limit_metric, x_axis_sort, metrics, groupby } = formData;
  const extra_metrics: QueryFormMetric[] = [];
  const [limitMetric] = ensureIsArray(timeseries_limit_metric);
  // The "Sort By" limit metric is only queried when the axis is sorted by it
  // and it is not already a value metric. This applies with dimensions too:
  // the pivot then yields one `<limit metric>, <dimension values>` column
  // per series, which the chart sums client-side to order the axis (the
  // backend sort operator only handles the single-series case).
  // With several series, `x_axis_sort` naming a `SortSeriesType` aggregate
  // means that aggregate (the control drops a colliding metric), so a limit
  // metric sharing its label is not a sort target and must not be queried.
  const isMultiSeries =
    ensureIsArray(groupby).length > 0 || ensureIsArray(metrics).length > 1;
  const isAggregateSort =
    isMultiSeries &&
    Object.values<string>(SortSeriesType).includes(x_axis_sort as string);
  if (
    !isAggregateSort &&
    limitMetric &&
    getMetricLabel(limitMetric) === x_axis_sort &&
    !metrics?.some(metric => getMetricLabel(metric) === x_axis_sort)
  ) {
    extra_metrics.push(limitMetric);
  }
  return extra_metrics;
}
