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
  PostProcessingRule,
  ensureIsArray,
} from '@superset-ui/core';
import {
  isTimeComparison,
  timeCompareOperator,
} from '@superset-ui/chart-controls';

export default function buildQuery(formData: QueryFormData) {
  const { cols: groupby } = formData;

  const queryContextA = buildQueryContext(formData, baseQueryObject => {
    const postProcessing: PostProcessingRule[] = [];
    postProcessing.push(timeCompareOperator(formData, baseQueryObject));
    return [
      {
        ...baseQueryObject,
        groupby,
        post_processing: postProcessing,
        time_offsets: isTimeComparison(formData, baseQueryObject)
          ? ensureIsArray(formData.time_compare)
          : [],
      },
    ];
  });

  return {
    ...queryContextA,
  };
}
