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
} from '@superset-ui/core';
import {
  flattenOperator,
  isTimeComparison,
  pivotOperator,
  resampleOperator,
  rollingWindowOperator,
  timeCompareOperator,
  timeComparePivotOperator,
} from '@superset-ui/chart-controls';
import type { PostProcessingContribution } from '@superset-ui/core';

/** The legacy `contribution` checkbox row-normalized the pivoted frame. */
const legacyContributionOperator = (
  formData: QueryFormData,
): PostProcessingContribution | undefined =>
  formData.contribution
    ? { operation: 'contribution', options: { orientation: 'row' } }
    : undefined;

/**
 * Mirrors the legacy NVD3TimeSeriesViz pipeline the rose chart rode on:
 * pivot on the timestamp, then resample, rolling window, time compare
 * and contribution as post-processing, flattened back into records for
 * transformProps to reshape.
 */
export default function buildQuery(rawFormData: QueryFormData) {
  // the legacy control emits 'absolute' where the v1 compare
  // post-processing operation expects 'difference'
  const formData: QueryFormData = {
    ...rawFormData,
    comparison_type:
      rawFormData.comparison_type === 'absolute'
        ? 'difference'
        : rawFormData.comparison_type,
  };
  return buildQueryContext(formData, baseQueryObject => {
    const firstMetric = ensureIsArray(baseQueryObject.metrics)[0];
    const queryObject = {
      ...baseQueryObject,
      is_timeseries: true,
      // the legacy engine ordered by the first metric, ascending unless
      // order_desc
      orderby: firstMetric
        ? ([[firstMetric, !formData.order_desc]] as [
            typeof firstMetric,
            boolean,
          ][])
        : undefined,
      time_offsets: isTimeComparison(formData, baseQueryObject)
        ? ensureIsArray(formData.time_compare)
        : [],
    };
    return [
      {
        ...queryObject,
        post_processing: [
          isTimeComparison(formData, queryObject)
            ? timeComparePivotOperator(formData, queryObject)
            : pivotOperator(formData, queryObject),
          resampleOperator(formData, queryObject),
          rollingWindowOperator(formData, queryObject),
          timeCompareOperator(formData, queryObject),
          legacyContributionOperator(formData),
          flattenOperator(formData, queryObject),
        ],
      },
    ];
  });
}
