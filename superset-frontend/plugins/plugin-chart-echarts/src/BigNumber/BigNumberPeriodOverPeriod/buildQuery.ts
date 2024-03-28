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
  ComparisonTimeRangeType,
  QueryFormData,
  getTimeComparisonFiltersByQueryObject,
} from '@superset-ui/core';

export default function buildQuery(formData: QueryFormData) {
  const baseQuery = buildQueryContext(formData, baseQueryObject => [
    baseQueryObject,
  ]);

  let shiftedFormData = formData;
  if (
    formData?.time_comparison === ComparisonTimeRangeType.Custom &&
    formData?.adhoc_custom
  ) {
    shiftedFormData = {
      ...formData,
      adhoc_filters: formData.adhoc_custom,
    };
  }
  const shiftedQuery = buildQueryContext(shiftedFormData, baseQueryObject => [
    {
      ...baseQueryObject,
      filters: getTimeComparisonFiltersByQueryObject(
        baseQueryObject,
        formData?.time_comparison,
      ),
    },
  ]);

  return {
    ...baseQuery,
    queries: [baseQuery.queries[0], shiftedQuery.queries[0]],
  };
}
