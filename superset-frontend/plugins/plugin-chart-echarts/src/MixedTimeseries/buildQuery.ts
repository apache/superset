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
  QueryObject,
  normalizeOrderBy,
  PostProcessingPivot,
} from '@superset-ui/core';
import {
  pivotOperator,
  renameOperator,
  flattenOperator,
  isTimeComparison,
  timeComparePivotOperator,
  rollingWindowOperator,
  timeCompareOperator,
  resampleOperator,
} from '@superset-ui/chart-controls';
import {
  removeFormDataSuffix,
  removeUnusedFormData,
} from '../utils/removeFormDataSuffix';

export default function buildQuery(formData: QueryFormData) {
  const baseFormData = {
    ...formData,
    is_timeseries: true,
    columns: formData.groupby,
    columns_b: formData.groupby_b,
  };
  const formData1 = removeUnusedFormData(baseFormData, '_b');
  const formData2 = removeFormDataSuffix(baseFormData, '_b');

  const queryContextA = buildQueryContext(formData1, baseQueryObject => {
    const queryObject = {
      ...baseQueryObject,
      is_timeseries: true,
    };

    const pivotOperatorInRuntime: PostProcessingPivot = isTimeComparison(
      formData1,
      queryObject,
    )
      ? timeComparePivotOperator(formData1, queryObject)
      : pivotOperator(formData1, queryObject);

    const queryObjectA = {
      ...queryObject,
      time_offsets: isTimeComparison(formData1, queryObject)
        ? formData1.time_compare
        : [],
      post_processing: [
        pivotOperatorInRuntime,
        rollingWindowOperator(formData1, queryObject),
        timeCompareOperator(formData1, queryObject),
        resampleOperator(formData1, queryObject),
        renameOperator(formData1, queryObject),
        flattenOperator(formData1, queryObject),
      ],
    } as QueryObject;
    return [normalizeOrderBy(queryObjectA)];
  });

  const queryContextB = buildQueryContext(formData2, baseQueryObject => {
    const queryObject = {
      ...baseQueryObject,
      is_timeseries: true,
    };

    const pivotOperatorInRuntime: PostProcessingPivot = isTimeComparison(
      formData2,
      queryObject,
    )
      ? timeComparePivotOperator(formData2, queryObject)
      : pivotOperator(formData2, queryObject);

    const queryObjectB = {
      ...queryObject,
      time_offsets: isTimeComparison(formData2, queryObject)
        ? formData2.time_compare
        : [],
      post_processing: [
        pivotOperatorInRuntime,
        rollingWindowOperator(formData2, queryObject),
        timeCompareOperator(formData2, queryObject),
        resampleOperator(formData2, queryObject),
        renameOperator(formData2, queryObject),
        flattenOperator(formData2, queryObject),
      ],
    } as QueryObject;
    return [normalizeOrderBy(queryObjectB)];
  });

  return {
    ...queryContextA,
    queries: [...queryContextA.queries, ...queryContextB.queries],
  };
}
