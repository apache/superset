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

import { QueryFormColumn, QueryFormMetric } from '@superset-ui/core';
import { Groupby, MetricsLayoutEnum, PivotTableQueryFormData } from '../types';

// Aggregates whose group total can be derived from per-group results
// (decomposable): summing sub-sums, counting sub-counts, min-of-mins,
// max-of-maxes. Everything else (AVG, COUNT_DISTINCT, percentiles, ratios,
// SQL/post-processing metrics) is non-additive and needs DB re-computation at
// each rollup level. See SIP.md.
const ADDITIVE_AGGREGATES = new Set(['SUM', 'COUNT', 'MIN', 'MAX']);

/**
 * Whether a metric's total can be derived additively from per-group results.
 * Conservative: only SIMPLE metrics with a known additive aggregate qualify;
 * saved-metric references (strings) and SQL/adhoc metrics are treated as
 * non-additive because their aggregate cannot be determined from form data.
 */
export function isAdditiveMetric(metric: QueryFormMetric): boolean {
  if (typeof metric === 'string' || metric.expressionType !== 'SIMPLE') {
    return false;
  }
  return !!metric.aggregate && ADDITIVE_AGGREGATES.has(metric.aggregate);
}

/**
 * True when every metric is additive, so totals/subtotals can use the cheap
 * single-query + client-side summation path instead of one query per rollup
 * level. An empty metric list is not considered additive (nothing to optimize).
 */
export function allMetricsAdditive(metrics: QueryFormMetric[]): boolean {
  return metrics.length > 0 && metrics.every(isAdditiveMetric);
}

export type RollupReducer = 'sum' | 'min' | 'max';

/**
 * How an additive metric's group total is derived from per-group values:
 * SUM/COUNT add up, MIN takes the min, MAX takes the max.
 */
export function additiveReducerFor(metric: QueryFormMetric): RollupReducer {
  if (typeof metric !== 'string' && metric.expressionType === 'SIMPLE') {
    if (metric.aggregate === 'MIN') return 'min';
    if (metric.aggregate === 'MAX') return 'max';
  }
  return 'sum';
}

function reduceValues(values: number[], reducer: RollupReducer): number {
  if (reducer === 'min') return Math.min(...values);
  if (reducer === 'max') return Math.max(...values);
  return values.reduce((acc, v) => acc + v, 0);
}

const GROUP_SEP = '\u0000';

/**
 * Additive fast-path: synthesize each rollup level's rows from the full-detail
 * leaf rows by grouping on that level's dimensions and reducing each metric,
 * instead of issuing one query per level. Correct only for additive metrics
 * (see {@link allMetricsAdditive}). Dimension and metric keys are the data-row
 * keys (labels) the caller resolves; `metricReducers` maps each metric key to
 * its reducer. Returns one row array per input level, in the same order.
 */
export function synthesizeAdditiveLevels(
  leafRows: Record<string, unknown>[],
  levels: { rows: string[]; columns: string[] }[],
  metricReducers: Record<string, RollupReducer>,
): Record<string, unknown>[][] {
  const metricKeys = Object.keys(metricReducers);
  return levels.map(level => {
    const dimKeys = [...level.rows, ...level.columns];
    const groups = new Map<
      string,
      { dims: Record<string, unknown>; rows: Record<string, unknown>[] }
    >();
    leafRows.forEach(row => {
      const key = dimKeys.map(d => String(row[d])).join(GROUP_SEP);
      let group = groups.get(key);
      if (!group) {
        const dims: Record<string, unknown> = {};
        dimKeys.forEach(d => {
          dims[d] = row[d];
        });
        group = { dims, rows: [] };
        groups.set(key, group);
      }
      group.rows.push(row);
    });
    return Array.from(groups.values()).map(({ dims, rows }) => {
      const out: Record<string, unknown> = { ...dims };
      metricKeys.forEach(metricKey => {
        const values = rows
          .map(r => r[metricKey])
          .filter(
            v => v !== null && v !== undefined && !Number.isNaN(Number(v)),
          )
          .map(Number);
        out[metricKey] = values.length
          ? reduceValues(values, metricReducers[metricKey])
          : null;
      });
      return out;
    });
  });
}

// Suffix of the per-column GROUPING() marker emitted by a GROUPING SETS query
// (or its per-level fallback). Must match superset/common/grouping_sets.py.
export const GROUPING_MARKER_SUFFIX = '__superset_grouping';

export function groupingMarkerLabel(columnLabel: string): string {
  return `${columnLabel}${GROUPING_MARKER_SUFFIX}`;
}

/**
 * Split a combined GROUPING SETS result into one row array per rollup level, by
 * matching each row's GROUPING() markers (0 = grouped at this level, 1 = rolled
 * up). The marker columns are stripped so each level looks like an ordinary
 * per-level query result. Inverse of the backend's grouping_sets query; mirrors
 * `split_grouping_sets_result` in superset/common/grouping_sets.py.
 */
export function splitGroupingSetsResult(
  rows: Record<string, any>[],
  levels: string[][],
  groupbyColumns: string[],
): Record<string, any>[][] {
  const markers = groupbyColumns.map(groupingMarkerLabel);
  // A result without GROUPING() markers (e.g. produced by a query that never
  // applied the `grouping_sets` extra) contains only full-granularity rows.
  // Attribute every row to the leaf level -- the one grouping all columns --
  // and leave the rollup levels empty, so totals cells render blank instead of
  // the marker filter discarding every row and blanking the whole chart.
  if (rows.length > 0 && !markers.some(marker => marker in rows[0])) {
    return levels.map(level => {
      const grouped = new Set(level);
      return groupbyColumns.every(col => grouped.has(col)) ? rows : [];
    });
  }
  return levels.map(level => {
    const grouped = new Set(level);
    return rows
      .filter(row =>
        groupbyColumns.every(
          col =>
            (Number(row[groupingMarkerLabel(col)]) === 0) === grouped.has(col),
        ),
      )
      .map(row => {
        const stripped = { ...row };
        markers.forEach(marker => delete stripped[marker]);
        return stripped;
      });
  });
}

/**
 * Enumerate the groupby combinations needed to compute correct subtotals and
 * grand totals for non-additive metrics. Each combination is one rollup level:
 * a prefix of the row dimensions crossed with a prefix of the column
 * dimensions. The empty `{rows: [], columns: []}` combination is the grand
 * total. Every level is then queried independently so the database computes the
 * metric at that granularity (see SIP.md), rather than re-aggregating cells.
 *
 * Only the levels actually displayed are emitted (a query-count optimization):
 * a level whose prefix is shorter than the full dimension list is a
 * total/subtotal that is queried only when the corresponding toggle is on. The
 * mapping mirrors TableRenderers exactly (display orientation, post-transpose):
 *   - rows fully collapsed (`[]`)        -> bottom "Total" row    -> colTotals
 *   - columns fully collapsed (`[]`)     -> right "Total" column  -> rowTotals
 *   - intermediate row prefix            -> row subtotal          -> rowSubTotals
 *   - intermediate column prefix         -> column subtotal       -> colSubTotals
 * A full-length prefix (the leaf level) is always emitted; when a dimension
 * list is empty, `[]` *is* the full level and is therefore always kept.
 */
export default function buildGroupbyCombinations(
  formData: PivotTableQueryFormData,
): Groupby[] {
  let columns: QueryFormColumn[] = formData.groupbyColumns ?? [];
  let rows: QueryFormColumn[] = formData.groupbyRows ?? [];

  [rows, columns] = formData.transposePivot ? [columns, rows] : [rows, columns];

  const rowsCombinations = [
    [] as QueryFormColumn[],
    ...rows.map((_, i) => rows.slice(0, i + 1)),
  ];
  const colsCombinations = [
    [] as QueryFormColumn[],
    ...columns.map((_, i) => columns.slice(0, i + 1)),
  ];

  const rowPrefixNeeded = (prefix: QueryFormColumn[]): boolean => {
    if (prefix.length === rows.length) return true; // leaf / full level
    if (prefix.length === 0) return !!formData.colTotals; // bottom Total row
    return !!formData.rowSubTotals; // row subtotal
  };
  const colPrefixNeeded = (prefix: QueryFormColumn[]): boolean => {
    if (prefix.length === columns.length) return true; // leaf / full level
    if (prefix.length === 0) return !!formData.rowTotals; // right Total column
    return !!formData.colSubTotals; // column subtotal
  };

  let groupbyCombinations: Groupby[] = rowsCombinations
    .filter(rowPrefixNeeded)
    .flatMap(row =>
      colsCombinations
        .filter(colPrefixNeeded)
        .map(col => ({ rows: row, columns: col })),
    );

  if (formData.combineMetric) {
    if (formData.metricsLayout === MetricsLayoutEnum.ROWS) {
      groupbyCombinations = groupbyCombinations.filter(
        combination => combination.rows.length === rows.length,
      );
    } else {
      groupbyCombinations = groupbyCombinations.filter(
        combination => combination.columns.length === columns.length,
      );
    }
  }

  return groupbyCombinations;
}
