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
import { buildQueryContext, getMetricLabel, QueryMode, removeDuplicates } from '@superset-ui/core';
import { PostProcessingRule } from '@superset-ui/core/src/query/types/PostProcessing';
import { TableChartFormData } from './types';
import { extractTimeseriesLimitMetric } from './utils/extractOrderby';

export default function buildQuery(formData: TableChartFormData) {
  const { percent_metrics: percentMetrics, order_desc: orderDesc = null } = formData;
  let { query_mode: queryMode } = formData;
  const timeseriesLimitMetric = extractTimeseriesLimitMetric(formData.timeseries_limit_metric);
  return buildQueryContext(formData, baseQueryObject => {
    let { metrics, orderby } = baseQueryObject;
    if (queryMode === undefined && metrics.length > 0) {
      queryMode = QueryMode.aggregate;
    }
    let postProcessing: PostProcessingRule[] = [];

    if (queryMode === QueryMode.aggregate) {
      // orverride orderby with timeseries metric when in aggregation mode
      if (timeseriesLimitMetric.length > 0 && orderDesc != null) {
        orderby = [[timeseriesLimitMetric[0], !orderDesc]];
      } else if (timeseriesLimitMetric.length === 0 && metrics?.length > 0 && orderDesc != null) {
        // default to ordering by first metric when no sort order has been specified
        orderby = [[metrics[0], !orderDesc]];
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
