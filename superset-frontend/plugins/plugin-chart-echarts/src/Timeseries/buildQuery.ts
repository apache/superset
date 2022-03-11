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
  flatOperator,
} from '@superset-ui/chart-controls';

export default function buildQuery(formData: QueryFormData) {
  const { x_axis, groupby } = formData;
  const is_timeseries = x_axis === DTTM_ALIAS || !x_axis;
  return buildQueryContext(formData, baseQueryObject => {
    const pivotOperatorInRuntime: PostProcessingPivot | undefined =
      isValidTimeCompare(formData, baseQueryObject)
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
        post_processing: [
          pivotOperatorInRuntime,
          resampleOperator(formData, baseQueryObject),
          rollingWindowOperator(formData, baseQueryObject),
          timeCompareOperator(formData, baseQueryObject),
          flatOperator(formData, baseQueryObject),
          contributionOperator(formData, baseQueryObject),
          prophetOperator(formData, baseQueryObject),
        ],
      },
    ];
  });
}
