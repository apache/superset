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
  getMetricLabel,
  normalizeOrderBy,
  QueryFormColumn,
} from '@superset-ui/core';
import { PivotTableQueryFormData } from '../types';

export default function buildQuery(formData: PivotTableQueryFormData) {
  const {
    groupbyColumns = [],
    groupbyRows = [],
    order_desc = true,
    legacy_order_by,
  } = formData;
  // TODO: add deduping of AdhocColumns
  const groupbySet = new Set([
    ...ensureIsArray<QueryFormColumn>(groupbyColumns),
    ...ensureIsArray<QueryFormColumn>(groupbyRows),
  ]);
  return buildQueryContext(formData, baseQueryObject => {
    const queryObject = normalizeOrderBy({
      ...baseQueryObject,
      order_desc,
      legacy_order_by,
    });
    const { metrics } = queryObject;
    const orderBy = ensureIsArray(legacy_order_by);
    if (
      orderBy.length &&
      !metrics?.find(
        metric => getMetricLabel(metric) === getMetricLabel(orderBy[0]),
      )
    ) {
      metrics?.push(orderBy[0]);
    }
    return [
      {
        ...queryObject,
        columns: [...groupbySet],
        metrics,
      },
    ];
  });
}
