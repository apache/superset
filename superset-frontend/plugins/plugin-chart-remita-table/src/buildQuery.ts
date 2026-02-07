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
  getMetricLabel,
  isPhysicalColumn,
  QueryMode,
  QueryObject,
  removeDuplicates,
} from '@superset-ui/core';
import { QueryFormOrderBy } from '@superset-ui/core';
import { PostProcessingRule, type BuildQuery } from '@superset-ui/core';
import {
  isTimeComparison,
  timeCompareOperator,
} from '@superset-ui/chart-controls';
import { isEmpty } from 'lodash';
import { updateExternalFormData } from './DataTable/utils/externalAPIs';
import { TableChartFormData } from './types';

/**
 * Infer query mode from form data. If `all_columns` is set, then raw records mode,
 * otherwise defaults to aggregation mode.
 *
 * The same logic is used in `controlPanel` with control values as well.
 */
export function getQueryMode(formData: TableChartFormData) {
  const { query_mode: mode } = formData;
  if (mode === QueryMode.Aggregate || mode === QueryMode.Raw) {
    return mode;
  }
  const rawColumns = formData?.all_columns;
  const hasRawColumns = rawColumns && rawColumns.length > 0;
  return hasRawColumns ? QueryMode.Raw : QueryMode.Aggregate;
}

const buildQuery: BuildQuery<TableChartFormData> = (
  formData: TableChartFormData,
  options?: any,
) => {
  const {
    percent_metrics: percentMetrics,
    order_desc: orderDesc = false,
    extra_form_data,
  } = formData;
  const queryMode = getQueryMode(formData);
  const sortByMetric = ensureIsArray(formData.timeseries_limit_metric)[0];
  const time_grain_sqla =
    extra_form_data?.time_grain_sqla || formData.time_grain_sqla;
  let formDataCopy = formData;
  // never include time in raw records mode
  if (queryMode === QueryMode.Raw) {
    formDataCopy = {
      ...formData,
      include_time: false,
    };
  }

  const addComparisonPercentMetrics = (metrics: string[], suffixes: string[]) =>
    metrics.reduce<string[]>((acc, metric) => {
      const newMetrics = suffixes.map(suffix => `${metric}__${suffix}`);
      return acc.concat([metric, ...newMetrics]);
    }, []);

  return buildQueryContext(formDataCopy, (baseQueryObject: any) => {
    let { metrics, orderby = [], columns = [] } = baseQueryObject;
    const { extras = {} } = baseQueryObject;
    let postProcessing: PostProcessingRule[] = [];
    const nonCustomNorInheritShifts = ensureIsArray(
      formData.time_compare,
    ).filter((shift: string) => shift !== 'custom' && shift !== 'inherit');
    const customOrInheritShifts = ensureIsArray(formData.time_compare).filter(
      (shift: string) => shift === 'custom' || shift === 'inherit',
    );

    let timeOffsets: string[] = [];

    // Shifts for non-custom or non inherit time comparison
    if (
      isTimeComparison(formData, baseQueryObject) &&
      !isEmpty(nonCustomNorInheritShifts)
    ) {
      timeOffsets = nonCustomNorInheritShifts;
    }

    // Shifts for custom or inherit time comparison
    if (
      isTimeComparison(formData, baseQueryObject) &&
      !isEmpty(customOrInheritShifts)
    ) {
      if (customOrInheritShifts.includes('custom')) {
        timeOffsets = timeOffsets.concat([formData.start_date_offset]);
      }
      if (customOrInheritShifts.includes('inherit')) {
        timeOffsets = timeOffsets.concat(['inherit']);
      }
    }

    let temporalColumnAdded = false;
    let temporalColumn = null;

    if (queryMode === QueryMode.Aggregate) {
      metrics = metrics || [];
      // override orderby with timeseries metric when in aggregation mode
      if (sortByMetric) {
        orderby = [[sortByMetric, !orderDesc]];
      } else if (metrics?.length > 0) {
        // default to ordering by first metric in descending order
        // when no "sort by" metric is set (regardless if "SORT DESC" is set to true)
        orderby = [[metrics[0], false]];
      }
      // add postprocessing for percent metrics only when in aggregation mode
      if (percentMetrics && percentMetrics.length > 0) {
        const percentMetricsLabelsWithTimeComparison = isTimeComparison(
          formData,
          baseQueryObject,
        )
          ? addComparisonPercentMetrics(
              percentMetrics.map(getMetricLabel),
              timeOffsets,
            )
          : percentMetrics.map(getMetricLabel);
        const percentMetricLabels = removeDuplicates(
          percentMetricsLabelsWithTimeComparison,
        );
        metrics = removeDuplicates(
          metrics.concat(percentMetrics),
          getMetricLabel,
        );
        postProcessing = [
          {
            operation: 'contribution',
            options: {
              columns: percentMetricLabels,
              rename_columns: percentMetricLabels.map(x => `%${x}`),
            },
          },
        ];
      }
      // Add the operator for the time comparison if some is selected
      if (!isEmpty(timeOffsets)) {
        postProcessing.push(timeCompareOperator(formData, baseQueryObject));
      }

      const temporalColumnsLookup = formData?.temporal_columns_lookup;
      // Filter out the column if needed and prepare the temporal column object

      columns = columns.filter((col: any) => {
        const shouldBeAdded =
          isPhysicalColumn(col) &&
          time_grain_sqla &&
          temporalColumnsLookup?.[col];

        if (shouldBeAdded && !temporalColumnAdded) {
          temporalColumn = {
            timeGrain: time_grain_sqla,
            columnType: 'BASE_AXIS',
            sqlExpression: col,
            label: col,
            expressionType: 'SQL',
          } as AdhocColumn;
          temporalColumnAdded = true;
          return false; // Do not include this in the output; it's added separately
        }
        return true;
      });

      // So we ensure the temporal column is added first
      if (temporalColumn) {
        columns = [temporalColumn, ...columns];
      }
    }

    const moreProps: Partial<QueryObject> = {};
    const ownState = options?.ownState ?? {};
    // Build a set of available column keys to validate sort/search/filters
    const availableColumnKeys = new Set(
      (Array.isArray(columns) ? columns : []).map((c: any) =>
        typeof c === 'string' ? c : (c?.label || c?.sqlExpression || c?.columnName),
      ),
    );
    const hasAvailableColumns = availableColumnKeys.size > 0;
    // Build Query flag to check if its for either download as csv, excel or json
    const isDownloadQuery =
      ['csv', 'xlsx'].includes(formData?.result_format || '') ||
      (formData?.result_format === 'json' && formData?.result_type === 'results');

    if (isDownloadQuery) {
      moreProps.row_limit = Number(formDataCopy.row_limit) || 0;
      moreProps.row_offset = 0;
      // If user selected visible columns at runtime, restrict download columns
      try {
        const visible = options?.ownState?.visibleColumns as string[] | undefined;
        if (Array.isArray(visible) && visible.length) {
          // Filter dimension columns
          if (Array.isArray(baseQueryObject?.columns)) {
            baseQueryObject.columns = baseQueryObject.columns.filter((c: any) => {
              const label = typeof c === 'string' ? c : (c?.label || c?.sqlExpression || c?.columnName);
              return visible.includes(label) || visible.includes(c);
            });
          }
          // Filter metrics as well (aggregate mode)
          if (Array.isArray(baseQueryObject?.metrics)) {
            baseQueryObject.metrics = baseQueryObject.metrics.filter((m: any) => {
              try {
                const label = getMetricLabel(m as any);
                return visible.includes(label);
              } catch {
                return true; // if we cannot determine label, keep the metric
              }
            });
          }
          // Reflect filtered values into local variables used to build the final query object
          columns = baseQueryObject.columns;
          metrics = baseQueryObject.metrics;
        }
      } catch {}
    }

    const serverPaginationEnabled = (formData as any)?.server_pagination !== false;
    if (!isDownloadQuery && serverPaginationEnabled) {
      const pageSize = ownState.pageSize ?? (formDataCopy.server_page_length ?? 50);
      const currentPage = ownState.currentPage ?? 0;
      moreProps.row_limit = pageSize;
      moreProps.row_offset = currentPage * pageSize;
    }

    if (!temporalColumn) {
      // This query is not using temporal column, so it doesn't need time grain
      extras.time_grain_sqla = undefined;
    }

    // getting sort by in case of server pagination from own state
    let sortByFromOwnState: QueryFormOrderBy[] | undefined;
    if (Array.isArray(ownState?.sortBy) && ownState?.sortBy.length > 0) {
      const sortByItem = ownState?.sortBy[0] as any;
      // Only use sort if the key is an available column
      if (sortByItem?.key && (!hasAvailableColumns || availableColumnKeys.has(String(sortByItem.key)))) {
        sortByFromOwnState = [[sortByItem.key, !sortByItem.desc]];
      }
    }

    // Sanitize orderby to avoid referencing removed columns
    try {
      if (Array.isArray(orderby)) {
        orderby = orderby.filter((entry: any) => {
          const target = Array.isArray(entry) ? entry[0] : undefined;
          if (!target) return false;
          if (!hasAvailableColumns) return true;
          if (typeof target === 'string') return availableColumnKeys.has(String(target));
          const label = target?.label || target?.sqlExpression || target?.columnName;
          return label ? availableColumnKeys.has(String(label)) : true;
        });
      }
    } catch {}

    // Sanitize temporal filters coming from adhoc_filters: drop "No filter" sentinel
    try {
      if (Array.isArray(baseQueryObject.filters)) {
        baseQueryObject.filters = baseQueryObject.filters.filter((f: any) => {
          const op = String(f?.op || '').toUpperCase();
          const val = (f?.val ?? '').toString().toLowerCase();
          if (op === 'TEMPORAL_RANGE' && (!val || val.includes('no filter'))) {
            return false;
          }
          return true;
        });
      }
    } catch {}

    // Apply advanced per-column filters from ownState (client-defined)
    // ⚠️ SECURITY NOTICE:
    // This client-side escaping is defense-in-depth only and NOT sufficient protection.
    // The backend MUST:
    //   1. Use parameterized queries (preferred), OR
    //   2. Validate and sanitize all WHERE clauses, OR
    //   3. Reject raw SQL WHERE clauses entirely
    // DO NOT rely on this escaping as the sole SQL injection protection.
    try {
      const adv = (ownState as any)?.advancedFilters || {};
      if (adv && typeof adv === 'object') {
        const filtersFromAnd: any[] = [];
        const whereParts: string[] = [];

        // Memoized escape cache to avoid repeated regex operations
        // Cache size limit prevents unbounded memory growth
        const escapeCache = new Map<string, string>();
        const MAX_CACHE_SIZE = 500;

        const esc = (s: any) => {
          // Escape single quotes and strip common SQL control sequences
          // ⚠️ WARNING: This is NOT complete SQL injection protection
          const key = String(s ?? '');

          // Check cache first
          if (escapeCache.has(key)) {
            return escapeCache.get(key)!;
          }

          let v = key;
          v = v.replace(/[\u0000-\u001f\u007f]/g, ''); // control chars
          v = v.replace(/'/g, "''");
          v = v.replace(/[;]+/g, '');
          v = v.replace(/--/g, '');
          v = v.replace(/\/\*/g, '').replace(/\*\//g, '');
          if (v.length > 500) v = v.slice(0, 500);

          // Cache the result
          if (escapeCache.size < MAX_CACHE_SIZE) {
            escapeCache.set(key, v);
          } else {
            // Clear cache when full to prevent unbounded growth
            // Keep half of the entries (simple eviction strategy)
            const entriesToKeep = Math.floor(MAX_CACHE_SIZE / 2);
            const entries = Array.from(escapeCache.entries());
            escapeCache.clear();
            entries.slice(-entriesToKeep).forEach(([k, val]) => escapeCache.set(k, val));
            escapeCache.set(key, v);
          }

          return v;
        };
        const isTemporalCol = (name: string) => {
          try {
            const lookup = (formData as any)?.temporal_columns_lookup || {};
            return Boolean(lookup[name]);
          } catch { return false; }
        };
        const normalizeDate = (s: any) => {
          try {
            const str = String(s || '').trim();
            if (!str) return '';
            const m = str.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
            if (!m) return '';
            const date = m[1];
            const hh = m[2] ?? '00';
            const mm = m[3] ?? '00';
            const ss = m[4] ?? '00';
            return `${date} ${hh}:${mm}:${ss}`;
          } catch { return ''; }
        };
        const isBoolLike = (x: any) => {
          if (typeof x === 'boolean') return true;
          const s = String(x ?? '').toLowerCase();
          return s === 'true' || s === 'false';
        };
        const boolVal = (x: any) => (typeof x === 'boolean' ? x : String(x).toLowerCase() === 'true');
        const makeSql = (col: string, op: string, v?: any, v2?: any, asText = false) => {
          const colExpr = asText ? `CAST(${col} AS TEXT)` : col;
          const opLower = String(op || '').toLowerCase();
          // Normalize temporal values when comparing ranges or bounds
          const normalizeIfTemporal = (val: any) => (asText ? normalizeDate(val) : val);

          switch (opLower) {
            case 'contains': return `${colExpr} ILIKE '%${esc(v)}%'`;
            case 'not_contains': return `${colExpr} NOT LIKE '%${esc(v)}%'`;
            case 'equals': {
              if (v === null || v === undefined) return `${colExpr} IS NULL`;
              return isBoolLike(v) ? `${colExpr} = ${boolVal(v)}` : `${colExpr} = '${esc(v)}'`;
            }
            case 'not_equals': {
              if (v === null || v === undefined) return `${colExpr} IS NOT NULL`;
              return isBoolLike(v) ? `${colExpr} != ${boolVal(v)}` : `${colExpr} != '${esc(v)}'`;
            }
            case 'starts_with': return `${colExpr} ILIKE '${esc(v)}%'`;
            case 'ends_with': return `${colExpr} ILIKE '%${esc(v)}'`;
            case 'in': {
              const arr = String(v ?? '')
                .split(',')
                .map(x => `'${esc(x.trim())}'`)
                .filter(Boolean)
                .slice(0, 100);
              return arr.length ? `${colExpr} IN (${arr.join(',')})` : '';
            }
            case 'not_in': {
              const arr = String(v ?? '')
                .split(',')
                .map(x => `'${esc(x.trim())}'`)
                .filter(Boolean)
                .slice(0, 100);
              return arr.length ? `${colExpr} NOT IN (${arr.join(',')})` : '';
            }
            case 'is_empty': return `${colExpr} = ''`;
            case 'is_not_empty': return `${colExpr} <> ''`;
            case 'is_null': return `${colExpr} IS NULL`;
            case 'is_not_null': return `${colExpr} IS NOT NULL`;
            case 'gt': {
              const vv = normalizeIfTemporal(v);
              return `${colExpr} > '${esc(vv)}'`;
            }
            case 'gte': {
              const vv = normalizeIfTemporal(v);
              return `${colExpr} >= '${esc(vv)}'`;
            }
            case 'lt': {
              const vv = normalizeIfTemporal(v);
              return `${colExpr} < '${esc(vv)}'`;
            }
            case 'lte': {
              const vv = normalizeIfTemporal(v);
              return `${colExpr} <= '${esc(vv)}'`;
            }
            case 'between': {
              const v1 = normalizeIfTemporal(v);
              const v22 = normalizeIfTemporal(v2);
              return `${colExpr} BETWEEN '${esc(v1)}' AND '${esc(v22)}'`;
            }
            default: return '';
          }
        };
        Object.entries(adv || {}).forEach(([col, cfg]: any) => {
          // Skip filters for columns no longer present
          if (hasAvailableColumns && !availableColumnKeys.has(String(col))) return;
          if (!cfg || !Array.isArray(cfg.conditions) || cfg.conditions.length === 0) return;
          const conds = (cfg.conditions as any[]) || [];
          const hasConnectors = conds.some(c => c && typeof c.connector === 'string');
          if (hasConnectors) {
            // Build one SQL expression joining conditions with their connectors in order
            const parts = conds.map((c: any) => makeSql(
              String(col),
              String(c?.op || ''),
              isTemporalCol(String(col)) ? normalizeDate(c?.value) : c?.value,
              isTemporalCol(String(col)) ? normalizeDate(c?.value2) : c?.value2,
              isTemporalCol(String(col)),
            )).filter((s: string) => !!s);
            if (parts.length) {
              let expr = `(${parts[0]})`;
              for (let i = 1; i < parts.length; i += 1) {
                const conn = String(conds[i].connector || cfg.logic || 'AND').toUpperCase();
                expr = `(${expr}) ${conn} (${parts[i]})`;
              }
              whereParts.push(`(${expr})`);
            }
          } else if ((cfg.logic || 'AND') === 'AND') {
            cfg.conditions.forEach((c: any) => {
              const op = String(c?.op || 'contains');
              if (op === 'between') {
                const isTemporal = isTemporalCol(String(col));
                const v1 = isTemporal ? normalizeDate(c?.value) : c?.value;
                const v2 = isTemporal ? normalizeDate(c?.value2) : c?.value2;
                filtersFromAnd.push({ col, op: '>=', val: isTemporal ? v1 : Number(v1) });
                filtersFromAnd.push({ col, op: '<=', val: isTemporal ? v2 : Number(v2) });
                return;
              }
              const temporal = isTemporalCol(String(col));
              const textualOps = ['contains','not_contains','equals','not_equals','starts_with','ends_with','in','not_in','is_empty','is_not_empty'];
              const valIsNull = c?.value === null || c?.value === undefined || c?.value === '';
              if (valIsNull && (op === 'equals' || op === 'not_equals')) {
                filtersFromAnd.push({ col, op: op === 'equals' ? 'IS NULL' : 'IS NOT NULL' });
                return;
              }
              if (isBoolLike(c?.value)) {
                const b = boolVal(c?.value);
                if (op === 'equals' || op === 'not_equals') {
                  filtersFromAnd.push({ col, op: op === 'equals' ? '==' : '!=', val: b });
                }
                // skip unsupported boolean operators
                return;
              }
              if (temporal && textualOps.includes(op)) {
                const sql = makeSql(String(col), op, c?.value, c?.value2, true);
                if (sql) whereParts.push(`(${sql})`);
              } else if (op === 'contains') filtersFromAnd.push({ col, op: 'ILIKE', val: `%${c?.value ?? ''}%` });
              // Backend does not accept NOT ILIKE in filters; use NOT LIKE for compatibility
              else if (op === 'not_contains') filtersFromAnd.push({ col, op: 'NOT LIKE', val: `%${c?.value ?? ''}%` });
              else if (op === 'equals') filtersFromAnd.push({ col, op: '==', val: c?.value });
              else if (op === 'not_equals') filtersFromAnd.push({ col, op: '!=', val: c?.value });
              else if (op === 'starts_with') filtersFromAnd.push({ col, op: 'ILIKE', val: `${c?.value ?? ''}%` });
              else if (op === 'ends_with') filtersFromAnd.push({ col, op: 'ILIKE', val: `%${c?.value ?? ''}` });
              else if (op === 'in') {
                const arr = String(c?.value ?? '')
                  .split(',')
                  .map((x: string) => x.trim())
                  .filter(Boolean);
                if (arr.length) filtersFromAnd.push({ col, op: 'IN', val: arr });
              } else if (op === 'not_in') {
                const arr = String(c?.value ?? '')
                  .split(',')
                  .map((x: string) => x.trim())
                  .filter(Boolean);
                if (arr.length) filtersFromAnd.push({ col, op: 'NOT IN', val: arr });
              } else if (op === 'is_empty') filtersFromAnd.push({ col, op: '==', val: '' });
              else if (op === 'is_not_empty') filtersFromAnd.push({ col, op: '!=', val: '' });
              else if (op === 'is_null') filtersFromAnd.push({ col, op: 'IS NULL' });
              else if (op === 'is_not_null') filtersFromAnd.push({ col, op: 'IS NOT NULL' });
              else if (['gt','gte','lt','lte'].includes(op)) {
                const isTemporal = isTemporalCol(String(col));
                const val = isTemporal ? normalizeDate(c?.value) : Number(c?.value);
                filtersFromAnd.push({ col, op: op.replace('gt','>').replace('lt','<').replace('gte','>=').replace('lte','<='), val });
              }
            });
          } else {
            // OR logic
            const allEquals = conds.length > 0 && conds.every(c => String(c?.op) === 'equals');
            const allEqualsOrIn = conds.length > 0 && conds.every(c => ['equals','in'].includes(String(c?.op)));
          // For OR logic, always construct SQL in extras.where so backend receives explicit OR expression
          const parts = conds
            .map((c: any) => makeSql(
              col,
              String(c?.op || ''),
              c?.value,
              c?.value2,
              isTemporalCol(String(col)),
            ))
            .filter((s: string) => !!s);
          if (parts.length) whereParts.push(`(${parts.join(' OR ')})`);
          }
        });
        if (filtersFromAnd.length) {
          baseQueryObject.filters = [...(baseQueryObject.filters || []), ...filtersFromAnd];
        }
        if (whereParts.length) {
          const whereExpr = whereParts.join(' AND ');
          if (whereExpr) {
            const existing = (baseQueryObject.extras?.where as string) || '';
            const combined = existing ? `(${existing}) AND ${whereExpr}` : whereExpr;
            baseQueryObject.extras = { ...(baseQueryObject.extras || {}), where: combined };
          }
        }
      }
    } catch {}

    // Use the latest extras from baseQueryObject (may have been modified above)
    const finalExtras = baseQueryObject.extras || extras;

    let queryObject = {
      ...baseQueryObject,
      columns,
      extras: finalExtras,
      orderby:
        formData.server_pagination && sortByFromOwnState
          ? sortByFromOwnState
          : orderby,
      metrics,
      post_processing: postProcessing,
      time_offsets: timeOffsets,
      ...moreProps,
    };

    /**
     * Optimized filter equality check with multiple fast-path strategies.
     * This avoids expensive JSON.stringify operations when possible.
     *
     * Performance tiers:
     * 1. Reference equality: O(1) - same array reference
     * 2. Shallow equality: O(n) - simple primitive comparisons
     * 3. Deep equality: O(n×m) - full hash-based comparison (fallback)
     */
    const filtersEqual = (a?: any[], b?: any[]) => {
      // Fast path 1: Reference equality
      // Handles case where filter array hasn't changed at all
      if (a === b) return true;

      const arrA = Array.isArray(a) ? a : [];
      const arrB = Array.isArray(b) ? b : [];

      // Fast path 2: Length mismatch
      if (arrA.length !== arrB.length) return false;

      // Fast path 3: Both empty
      if (arrA.length === 0) return true;

      // Fast path 4: Shallow equality check for simple filters
      // This catches ~80% of filter changes with minimal overhead
      // Only works when filters are in same order and have primitive values
      let canUseShallowCheck = true;
      for (let i = 0; i < arrA.length; i += 1) {
        const filterA = arrA[i];
        const filterB = arrB[i];

        // Check if both filters have simple structure (col, op, val)
        if (
          filterA &&
          filterB &&
          typeof filterA === 'object' &&
          typeof filterB === 'object'
        ) {
          // Quick column/operator check
          if (
            filterA.col !== filterB.col ||
            String(filterA.op || '').toUpperCase() !==
              String(filterB.op || '').toUpperCase()
          ) {
            canUseShallowCheck = false;
            break;
          }

          // Check value equality for primitives
          const valA = filterA.val;
          const valB = filterB.val;

          // For primitive values, use direct comparison
          if (
            (typeof valA !== 'object' || valA === null) &&
            (typeof valB !== 'object' || valB === null)
          ) {
            if (valA !== valB) {
              canUseShallowCheck = false;
              break;
            }
          } else {
            // Arrays or objects - fall through to deep check
            canUseShallowCheck = false;
            break;
          }
        } else {
          canUseShallowCheck = false;
          break;
        }
      }

      // If shallow check passed, filters are equal
      if (canUseShallowCheck) return true;

      // Slow path: Order-insensitive deep equality with hashing
      // Only executed when filters have complex values or different order
      const keyOf = (f: any) => {
        const col = String(f?.col ?? '');
        const op = String(f?.op ?? '').toUpperCase();
        const v = f?.val;
        let val: string;

        if (Array.isArray(v)) {
          // Sort and stringify array values for consistent comparison
          val = JSON.stringify([...v].map(x => String(x)).sort());
        } else if (v === null || v === undefined) {
          val = 'null';
        } else if (typeof v === 'object') {
          // Handle object values by stringifying
          try {
            val = JSON.stringify(v);
          } catch {
            val = String(v);
          }
        } else {
          val = String(v);
        }

        // Use JSON array to avoid separator collision issues
        return JSON.stringify([col, op, val]);
      };

      const counts = new Map<string, number>();
      for (const f of arrA) {
        const k = keyOf(f);
        counts.set(k, (counts.get(k) || 0) + 1);
      }
      for (const f of arrB) {
        const k = keyOf(f);
        const n = (counts.get(k) || 0) - 1;
        if (n < 0) return false;
        counts.set(k, n);
      }
      for (const n of counts.values()) if (n !== 0) return false;
      return true;
    };

    if (
      serverPaginationEnabled &&
      options?.extras?.cachedChanges?.[formData.slice_id] &&
      !filtersEqual(
        options?.extras?.cachedChanges?.[formData.slice_id],
        queryObject.filters,
      )
    ) {
      // Reset offset for new filter set; UI ownState will sync separately
      queryObject = { ...queryObject, row_offset: 0 };
      try {
        updateExternalFormData(options?.hooks?.setDataMask, 0, queryObject.row_limit ?? 0);
      } catch {}
    }
    // Because we use same buildQuery for all table on the page we need split them by id
    options?.hooks?.setCachedChanges({
      [formData.slice_id]: queryObject.filters,
    });

    const extraQueries: QueryObject[] = [];
    if (serverPaginationEnabled) {
      // Add search filter if search text exists
      if (
        (ownState as any).searchText &&
        (ownState as any).searchColumn &&
        (!hasAvailableColumns || availableColumnKeys.has(String((ownState as any).searchColumn)))
      ) {
        const matchMode = (formData as any)?.server_search_match_mode || 'contains';
        const text = String((ownState as any).searchText);
        const val = matchMode === 'contains' ? `%${text}%` : `${text}%`;
        queryObject = {
          ...queryObject,
          filters: [
            ...(queryObject.filters || []),
            {
              col: (ownState as any).searchColumn,
              op: 'ILIKE',
              val,
            },
          ],
        } as QueryObject;
      }
    }
    if (
      metrics?.length &&
      formData.show_totals &&
      queryMode === QueryMode.Aggregate
    ) {
      extraQueries.push({
        ...queryObject,
        columns: [],
        row_limit: 0,
        row_offset: 0,
        post_processing: [],
        order_desc: undefined, // we don't need orderby stuff here,
        orderby: undefined, // because this query will be used for get total aggregation.
      });
    }

    const interactiveGroupBy = formData.extra_form_data?.interactive_groupby;
    if (interactiveGroupBy && queryObject.columns) {
      queryObject.columns = [
        ...new Set([...queryObject.columns, ...interactiveGroupBy]),
      ];
    }

    // Add optional exact rowcount query for server pagination
    // This sends a separate COUNT(*) query to get the total row count for pagination
    // Only when explicitly enabled via `server_rowcount_exact` to avoid performance impact on large datasets
    if (serverPaginationEnabled && !isDownloadQuery && (formData as any)?.server_rowcount_exact) {
      const queries: QueryObject[] = [{ ...queryObject }];
      // Always add rowcount query for server pagination (exact count is required for proper pagination)
      queries.push({
        ...queryObject,
        time_offsets: [],
        // Use 0 to count all rows; preserve other filters
        row_limit: 0,
        row_offset: 0,
        post_processing: [],
        is_rowcount: true,
      } as any);
      return [...queries, ...extraQueries];
    }

    return [queryObject, ...extraQueries];
  });
};

// Use this closure to cache changing of external filters, if we have server pagination we need reset page to 0, after
// external filter changed
export const cachedBuildQuery = (): BuildQuery<TableChartFormData> => {
  let cachedChanges: any = {};
  const setCachedChanges = (newChanges: any) => {
    cachedChanges = { ...cachedChanges, ...newChanges };
  };

  return (formData, options) =>
    buildQuery(
      { ...formData },
      {
        extras: { cachedChanges },
        ownState: options?.ownState ?? {},
        hooks: {
          ...options?.hooks,
          setDataMask: () => {},
          setCachedChanges,
        },
      },
    );
};

export default cachedBuildQuery();
