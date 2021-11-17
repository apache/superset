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
  QueryFormData,
  normalizeOrderBy,
  RollingType,
  PostProcessingPivot,
} from '@superset-ui/core';
import {
  rollingWindowOperator,
  timeCompareOperator,
  isValidTimeCompare,
  sortOperator,
  pivotOperator,
  resampleOperator,
  contributionOperator,
  prophetOperator,
} from '@superset-ui/chart-controls';

export default function buildQuery(formData: QueryFormData) {
  return buildQueryContext(formData, baseQueryObject => {
    const pivotOperatorInRuntime: PostProcessingPivot | undefined =
      pivotOperator(formData, {
        ...baseQueryObject,
        is_timeseries: true,
      });
    if (
      pivotOperatorInRuntime &&
      Object.values(RollingType).includes(formData.rolling_type)
    ) {
      pivotOperatorInRuntime.options = {
        ...pivotOperatorInRuntime.options,
        ...{
          flatten_columns: false,
          reset_index: false,
        },
      };
    }

    return [
      {
        ...baseQueryObject,
        is_timeseries: true,
        // todo: move `normalizeOrderBy to extractQueryFields`
        orderby: normalizeOrderBy(baseQueryObject).orderby,
        time_offsets: isValidTimeCompare(formData, baseQueryObject)
          ? formData.time_compare
          : [],
        post_processing: [
          resampleOperator(formData, baseQueryObject),
          timeCompareOperator(formData, baseQueryObject),
          sortOperator(formData, { ...baseQueryObject, is_timeseries: true }),
          // in order to be able to rolling in multiple series, must do pivot before rollingOperator
          pivotOperatorInRuntime,
          rollingWindowOperator(formData, baseQueryObject),
          contributionOperator(formData, baseQueryObject),
          prophetOperator(formData, baseQueryObject),
        ],
      },
    ];
  });
}
