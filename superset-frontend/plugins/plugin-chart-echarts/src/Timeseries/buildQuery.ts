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
  DTTM_ALIAS,
  ensureIsArray,
  QueryFormData,
  normalizeOrderBy,
  PostProcessingPivot,
} from '@superset-ui/core';
import {
  rollingWindowOperator,
  timeCompareOperator,
  isValidTimeCompare,
  pivotOperator,
  resampleOperator,
  contributionOperator,
  prophetOperator,
  timeComparePivotOperator,
  flattenOperator,
} from '@superset-ui/chart-controls';

export default function buildQuery(formData: QueryFormData) {
  const { x_axis, groupby } = formData;
  const is_timeseries = x_axis === DTTM_ALIAS || !x_axis;
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
    const pivotOperatorInRuntime: PostProcessingPivot = isValidTimeCompare(
      formData,
      baseQueryObject,
    )
      ? timeComparePivotOperator(formData, baseQueryObject)
      : pivotOperator(formData, {
          ...baseQueryObject,
          index: x_axis,
          is_timeseries,
        });

    return [
      {
        ...baseQueryObject,
        columns: [...ensureIsArray(x_axis), ...ensureIsArray(groupby)],
        series_columns: groupby,
        is_timeseries,
        // todo: move `normalizeOrderBy to extractQueryFields`
        orderby: normalizeOrderBy(baseQueryObject).orderby,
        time_offsets: isValidTimeCompare(formData, baseQueryObject)
          ? formData.time_compare
          : [],
        /* Note that:
          1. The resample, rolling, cum, timeCompare operators should be after pivot.
          2. the flatOperator makes multiIndex Dataframe into flat Dataframe
        */
        post_processing: [
          pivotOperatorInRuntime,
          rollingWindowOperator(formData, baseQueryObject),
          timeCompareOperator(formData, baseQueryObject),
          resampleOperator(formData, baseQueryObject),
          flattenOperator(formData, baseQueryObject),
          contributionOperator(formData, baseQueryObject),
          prophetOperator(formData, baseQueryObject),
        ],
      },
    ];
  });
}
