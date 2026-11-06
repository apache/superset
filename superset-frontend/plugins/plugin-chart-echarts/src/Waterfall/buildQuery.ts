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
  AdhocMetricSimple,
  buildQueryContext,
  ensureIsArray,
  getColumnLabel,
  getMetricLabel,
  QueryFormColumn,
  QueryFormData,
  QueryFormMetric,
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
    // Keep the category's rows contiguous by falling back to the x-axis (and
    // breakdown) columns. This is also the ordering when no custom sort is set.
    const baseOrderby: QueryFormOrderBy[] = columns.map(
      (column: QueryFormColumn) => [column, true],
    );
    if (!x_axis_sort) {
      return [{ ...baseQueryObject, columns, orderby: baseOrderby }];
    }

    const ascending = !!x_axis_sort_asc;
    const isGroupedColumn = columns.some(
      (column: QueryFormColumn) => getColumnLabel(column) === x_axis_sort,
    );
    const isMetric = ensureIsArray(baseQueryObject.metrics).some(
      metric => getMetricLabel(metric) === x_axis_sort,
    );
    // A sort key that is already a grouping column or a selected metric can be
    // referenced by label. Anything else is a bare dataset column, which an
    // aggregated query cannot ORDER BY unless it is itself aggregated: adding
    // it to `columns` instead would put it in the GROUP BY and change the grain
    // of the query, inflating the row count until `row_limit` truncates it and
    // the bars silently under-report (#42372). Wrapping it in MIN() orders the
    // categories by that column without touching the grain.
    const sortBy: QueryFormMetric =
      isGroupedColumn || isMetric
        ? x_axis_sort
        : ({
            expressionType: 'SIMPLE',
            column: { column_name: x_axis_sort },
            aggregate: 'MIN',
            label: x_axis_sort,
            hasCustomLabel: true,
          } as AdhocMetricSimple);

    return [
      {
        ...baseQueryObject,
        columns,
        orderby: [[sortBy, ascending], ...baseOrderby],
      },
    ];
  });
}
