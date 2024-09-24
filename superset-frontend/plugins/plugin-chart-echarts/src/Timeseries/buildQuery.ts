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
  getXAxisColumn,
  isXAxisSet,
  normalizeOrderBy,
  PostProcessingPivot,
  QueryFormData,
} from '@superset-ui/core';
import {
  contributionOperator,
  extractExtraMetrics,
  flattenOperator,
  isTimeComparison,
  pivotOperator,
  prophetOperator,
  renameOperator,
  resampleOperator,
  rollingWindowOperator,
  sortOperator,
  timeComparePivotOperator,
  timeCompareOperator,
} from '@superset-ui/chart-controls';

export default function buildQuery(formData: QueryFormData) {
  const { groupby } = formData;
  return buildQueryContext(formData, baseQueryObject => {
    /* the `pivotOperatorInRuntime` determines how to pivot the dataframe returned from the raw query.
       1. If it's a time compared query, there will return a pivoted dataframe that append time compared metrics. for instance:

                            MAX(value) MAX(value)__1 year ago MIN(value) MIN(value)__1 year ago
          city               LA                     LA         LA                     LA
          __timestamp
          2015-01-01      568.0                  671.0        5.0                    6.0
          2015-02-01      407.0                  649.0        4.0                    3.0
          2015-03-01      318.0                  465.0        0.0                    3.0

       2. If it's a normal query, there will return a pivoted dataframe.

                     MAX(value)  MIN(value)
          city               LA          LA
          __timestamp
          2015-01-01      568.0         5.0
          2015-02-01      407.0         4.0
          2015-03-01      318.0         0.0

     */
    // only add series limit metric if it's explicitly needed e.g. for sorting
    const extra_metrics = extractExtraMetrics(formData);

    const pivotOperatorInRuntime: PostProcessingPivot = isTimeComparison(
      formData,
      baseQueryObject,
    )
      ? timeComparePivotOperator(formData, baseQueryObject)
      : pivotOperator(formData, baseQueryObject);

    const columns = [
      ...(isXAxisSet(formData) ? ensureIsArray(getXAxisColumn(formData)) : []),
      ...ensureIsArray(groupby),
    ];

    const time_offsets = isTimeComparison(formData, baseQueryObject)
      ? formData.time_compare
      : [];

    return [
      {
        ...baseQueryObject,
        metrics: [...(baseQueryObject.metrics || []), ...extra_metrics],
        columns,
        series_columns: groupby,
        ...(isXAxisSet(formData) ? {} : { is_timeseries: true }),
        // todo: move `normalizeOrderBy to extractQueryFields`
        orderby: normalizeOrderBy(baseQueryObject).orderby,
        time_offsets,
        /* Note that:
          1. The resample, rolling, cum, timeCompare operators should be after pivot.
          2. the flatOperator makes multiIndex Dataframe into flat Dataframe
        */
        post_processing: [
          pivotOperatorInRuntime,
          rollingWindowOperator(formData, baseQueryObject),
          timeCompareOperator(formData, baseQueryObject),
          resampleOperator(formData, baseQueryObject),
          renameOperator(formData, baseQueryObject),
          contributionOperator(formData, baseQueryObject, time_offsets),
          sortOperator(formData, baseQueryObject),
          flattenOperator(formData, baseQueryObject),
          // todo: move prophet before flatten
          prophetOperator(formData, baseQueryObject),
        ],
      },
    ];
  });
}
