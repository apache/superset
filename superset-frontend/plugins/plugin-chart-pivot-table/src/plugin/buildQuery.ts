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
  AdhocColumn,
  buildQueryContext,
  ensureIsArray,
  getColumnLabel,
  isPhysicalColumn,
  QueryFormColumn,
  QueryFormOrderBy,
  TimeGranularity,
} from '@superset-ui/core';
import { Groupby, PivotTableQueryFormData } from '../types';
import buildGroupbyCombinations, { allMetricsAdditive } from './utilities';

// Build the query `columns` for a single rollup level (one prefix of row dims
// crossed with one prefix of column dims), applying temporal BASE_AXIS handling.
function getQueryColumns(
  groupby: Groupby,
  formData: PivotTableQueryFormData,
  timeGrainSqla: TimeGranularity | undefined,
): QueryFormColumn[] {
  // TODO: add deduping of AdhocColumns
  return Array.from(
    new Set([
      ...ensureIsArray<QueryFormColumn>(groupby.rows),
      ...ensureIsArray<QueryFormColumn>(groupby.columns),
    ]),
  ).map(col => {
    if (
      isPhysicalColumn(col) &&
      timeGrainSqla &&
      (formData?.temporal_columns_lookup?.[col] ||
        formData.granularity_sqla === col)
    ) {
      return {
        timeGrain: timeGrainSqla,
        columnType: 'BASE_AXIS',
        sqlExpression: col,
        label: col,
        expressionType: 'SQL',
      } as AdhocColumn;
    }
    return col;
  });
}

export default function buildQuery(formData: PivotTableQueryFormData) {
  const { extra_form_data } = formData;
  const time_grain_sqla =
    extra_form_data?.time_grain_sqla || formData.time_grain_sqla;

  // The full set of dimensions (the leaf level) is always queried; the rollup
  // levels are derived from it. Apply transposePivot here exactly as
  // buildGroupbyCombinations does, so the column order matches the rollup
  // levels. See SIP.md.
  const [fullRows, fullColumnDims] = formData.transposePivot
    ? [formData.groupbyColumns, formData.groupbyRows]
    : [formData.groupbyRows, formData.groupbyColumns];
  const fullGroupby: Groupby = {
    rows: ensureIsArray<QueryFormColumn>(fullRows),
    columns: ensureIsArray<QueryFormColumn>(fullColumnDims),
  };
  const fullColumns = getQueryColumns(fullGroupby, formData, time_grain_sqla);

  // A single query always suffices:
  //  - additive metrics (SUM/COUNT/MIN/MAX): a full-detail query whose
  //    subtotals/grand totals transformProps derives by client-side reduction.
  //  - non-additive metrics: a GROUPING SETS query (one `grouping_sets` level
  //    per displayed total/subtotal) so the database computes every level; the
  //    backend falls back to per-level queries on engines without native
  //    support. transformProps splits the combined result by level.
  const additive = allMetricsAdditive(ensureIsArray(formData.metrics));
  const groupingSets = additive
    ? undefined
    : buildGroupbyCombinations(formData).map(level =>
        // A dimension placed on both axes (a valid, if unusual, config) would
        // otherwise appear twice in the same level, producing a duplicate
        // column in the GROUPING SETS tuple sent to the database.
        Array.from(
          new Set([...level.rows, ...level.columns].map(getColumnLabel)),
        ),
      );

  return buildQueryContext(formData, baseQueryObject => {
    const { series_limit_metric, metrics, order_desc } = baseQueryObject;
    let orderBy: QueryFormOrderBy[] | undefined;
    if (series_limit_metric) {
      orderBy = [[series_limit_metric, !order_desc]];
    } else if (Array.isArray(metrics) && metrics[0]) {
      orderBy = [[metrics[0], !order_desc]];
    }
    return [
      {
        ...baseQueryObject,
        orderby: orderBy,
        columns: fullColumns,
        ...(groupingSets ? { grouping_sets: groupingSets } : {}),
      },
    ];
  });
}
