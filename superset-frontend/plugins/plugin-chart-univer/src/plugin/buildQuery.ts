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
  getColumnLabel,
  getMetricLabel,
  normalizeOrderBy,
  PostProcessingFlatten,
  PostProcessingPivot,
  QueryFormColumn,
} from '@superset-ui/core';
import { PIVOT_MODE } from './controls/shared';
import { UniverQueryFormData } from '../types';

// label of the Total row and columns in pivot mode
export const PIVOT_TOTAL = 'Total';

/**
 * Groups by the row and column fields, then pivots the result with Superset's
 * `pivot` post-processing: one row per row field combination and one column
 * per metric and column field combination. `flatten` joins the column levels
 * with ", " (see buildPivotGrid, which splits them into header rows).
 */
function buildPivotQuery(formData: UniverQueryFormData) {
  const rows = ensureIsArray<QueryFormColumn>(formData.univer_pivot_rows);
  const columns = ensureIsArray<QueryFormColumn>(
    formData.univer_pivot_columns,
  ).filter(column => !rows.includes(column));
  return buildQueryContext(formData, baseQueryObject => {
    const metrics = ensureIsArray(baseQueryObject.metrics);
    const pivot: PostProcessingPivot = {
      operation: 'pivot',
      options: {
        index: rows.map(getColumnLabel),
        columns: columns.map(getColumnLabel),
        // each cell already holds one aggregated value, sum also adds up totals
        aggregates: Object.fromEntries(
          metrics.map(metric => [getMetricLabel(metric), { operator: 'sum' }]),
        ),
        drop_missing_columns: true,
        marginal_distributions: formData.univer_pivot_totals ?? true,
        marginal_distribution_name: PIVOT_TOTAL,
      },
    };
    const flatten: PostProcessingFlatten = { operation: 'flatten' };
    return [
      {
        ...baseQueryObject,
        columns: [...rows, ...columns],
        orderby: metrics[0] ? [[metrics[0], false]] : [],
        post_processing: [pivot, flatten],
      },
    ];
  });
}

export default function buildQuery(formData: UniverQueryFormData) {
  if (formData.query_mode === PIVOT_MODE) return buildPivotQuery(formData);
  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      orderby: normalizeOrderBy(baseQueryObject).orderby,
    },
  ]);
}
