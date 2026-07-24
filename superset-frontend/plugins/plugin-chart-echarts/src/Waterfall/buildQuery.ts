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
  QueryFormColumn,
  QueryFormData,
  QueryFormOrderBy,
} from '@superset-ui/core';

export default function buildQuery(formData: QueryFormData) {
  const {
    x_axis,
    granularity_sqla,
    groupby,
    x_axis_sort,
    x_axis_sort_asc = true,
  } = formData;
  const columns = [
    ...ensureIsArray(x_axis || granularity_sqla),
    ...ensureIsArray(groupby),
  ];
  return buildQueryContext(formData, baseQueryObject => {
    const isMetricSort =
      !!x_axis_sort &&
      ensureIsArray(baseQueryObject.metrics).some(
        metric => getMetricLabel(metric) === x_axis_sort,
      );
    // A sort column that isn't already selected (and isn't a metric) must be
    // added to the query so that ORDER BY can reference it.
    const extraSortColumns =
      x_axis_sort && !isMetricSort && !columns.includes(x_axis_sort)
        ? [x_axis_sort]
        : [];
    // Lead with the chosen sort key, then keep each category's rows contiguous
    // by falling back to the x-axis (and breakdown) columns. When no custom
    // sort is set, preserve the historical "order by x-axis ascending".
    const baseOrderby: QueryFormOrderBy[] = columns.map(
      (column: QueryFormColumn) => [column, true],
    );
    const orderby: QueryFormOrderBy[] = x_axis_sort
      ? [[x_axis_sort, !!x_axis_sort_asc], ...baseOrderby]
      : baseOrderby;
    return [
      {
        ...baseQueryObject,
        columns: [...columns, ...extraSortColumns],
        orderby,
      },
    ];
  });
}
