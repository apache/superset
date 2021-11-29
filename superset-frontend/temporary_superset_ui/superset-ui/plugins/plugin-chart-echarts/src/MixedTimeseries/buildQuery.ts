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
} from '@superset-ui/core';
import { pivotOperator } from '@superset-ui/chart-controls';

export default function buildQuery(formData: QueryFormData) {
  const {
    adhoc_filters,
    adhoc_filters_b,
    groupby,
    groupby_b,
    limit,
    limit_b,
    timeseries_limit_metric,
    timeseries_limit_metric_b,
    metrics,
    metrics_b,
    order_desc,
    order_desc_b,
    ...baseFormData
  } = formData;
  baseFormData.is_timeseries = true;
  const formData1 = {
    ...baseFormData,
    adhoc_filters,
    columns: groupby,
    limit,
    timeseries_limit_metric,
    metrics,
    order_desc,
  };
  const formData2 = {
    ...baseFormData,
    adhoc_filters: adhoc_filters_b,
    columns: groupby_b,
    limit: limit_b,
    timeseries_limit_metric: timeseries_limit_metric_b,
    metrics: metrics_b,
    order_desc: order_desc_b,
  };

  const queryContextA = buildQueryContext(formData1, baseQueryObject => {
    const queryObjectA = {
      ...baseQueryObject,
      is_timeseries: true,
      post_processing: [
        pivotOperator(formData1, { ...baseQueryObject, is_timeseries: true }),
      ],
    } as QueryObject;
    return [normalizeOrderBy(queryObjectA)];
  });

  const queryContextB = buildQueryContext(formData2, baseQueryObject => {
    const queryObjectB = {
      ...baseQueryObject,
      is_timeseries: true,
      post_processing: [
        pivotOperator(formData2, { ...baseQueryObject, is_timeseries: true }),
      ],
    } as QueryObject;
    return [normalizeOrderBy(queryObjectB)];
  });

  return {
    ...queryContextA,
    queries: [...queryContextA.queries, ...queryContextB.queries],
  };
}
