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
  QueryMode,
  removeDuplicates,
  ensureIsArray,
} from '@superset-ui/core';
import { PostProcessingRule } from '@superset-ui/core/src/query/types/PostProcessing';
import { TableChartFormData } from './types';

/**
 * Infer query mode from form data. If `all_columns` is set, then raw records mode,
 * otherwise defaults to aggregation mode.
 *
 * The same logic is used in `controlPanel` with control values as well.
 */
export function getQueryMode(formData: TableChartFormData) {
  const { query_mode: mode } = formData;
  if (mode === QueryMode.aggregate || mode === QueryMode.raw) {
    return mode;
  }
  const rawColumns = formData?.all_columns;
  const hasRawColumns = rawColumns && rawColumns.length > 0;
  return hasRawColumns ? QueryMode.raw : QueryMode.aggregate;
}

export default function buildQuery(formData: TableChartFormData) {
  const { percent_metrics: percentMetrics, order_desc: orderDesc = false } = formData;
  const queryMode = getQueryMode(formData);
  const sortByMetric = ensureIsArray(formData.timeseries_limit_metric)[0];
  return buildQueryContext(formData, baseQueryObject => {
    let { metrics, orderby } = baseQueryObject;
    let postProcessing: PostProcessingRule[] = [];

    if (queryMode === QueryMode.aggregate) {
      // orverride orderby with timeseries metric when in aggregation mode
      if (sortByMetric) {
        orderby = [[sortByMetric, !orderDesc]];
      } else if (metrics?.length > 0) {
        // default to ordering by first metric in descending order
        // when no "sort by" metric is set (regargless if "SORT DESC" is set to true)
        orderby = [[metrics[0], false]];
      }
      // add postprocessing for percent metrics only when in aggregation mode
      if (percentMetrics && percentMetrics.length > 0) {
        const percentMetricLabels = percentMetrics.map(getMetricLabel);
        metrics = removeDuplicates(metrics.concat(percentMetrics), getMetricLabel);
        postProcessing = [
          {
            operation: 'contribution',
            options: {
              columns: percentMetricLabels,
              rename_columns: percentMetricLabels.map(x => `%${x}`),
            },
          },
        ];
      }
    }

    return [
      {
        ...baseQueryObject,
        orderby,
        metrics,
        post_processing: postProcessing,
      },
    ];
  });
}
