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
  Encoding,
  EncodingShape,
  Formatter,
  Primitive,
  VariableValues,
} from './types';

const VAR_REF = /^\$([A-Za-z_][\w]*)$/;

export const isVarRef = (v: unknown): v is string =>
  typeof v === 'string' && VAR_REF.test(v);

/** Deep-substitute every `$var` reference in a value with its current value. */
export function resolveVars<T>(value: T, vars: VariableValues): T {
  if (isVarRef(value)) {
    return vars[value.slice(1)] as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(v => resolveVars(v, vars)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      out[k] = resolveVars(v, vars);
    });
    return out as unknown as T;
  }
  return value;
}

export interface QueryResult {
  columns: string[];
  records: Array<Record<string, Primitive>>;
}

const distinct = (values: string[]): string[] => Array.from(new Set(values));
const toNumber = (v: unknown): number =>
  typeof v === 'number' ? v : Number(v);

/**
 * Resolve a requested column name against what the query actually returned.
 * The AI's `encoding` label (e.g. `SUM(global_sales)`) may not exactly match
 * the response column, so fall back to a case-insensitive match, a substring
 * match, or — if only one measure column remains — that column.
 */
function resolveColumn(
  requested: string,
  columns: string[],
  exclude: string[],
): string {
  if (columns.includes(requested)) {
    return requested;
  }
  const lower = requested.toLowerCase();
  const caseInsensitive = columns.find(c => c.toLowerCase() === lower);
  if (caseInsensitive) {
    return caseInsensitive;
  }
  const candidates = columns.filter(c => !exclude.includes(c));
  const substring = candidates.find(
    c => c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase()),
  );
  if (substring) {
    return substring;
  }
  if (candidates.length === 1) {
    return candidates[0];
  }
  return requested;
}

const NAME_VALUE_TYPES = new Set([
  'pie',
  'funnel',
  'treemap',
  'sunburst',
  'gauge',
]);

function firstSeriesType(
  baseOption: Record<string, unknown>,
): string | undefined {
  const { series } = baseOption;
  const first = Array.isArray(series) ? series[0] : series;
  const type = (first as Record<string, unknown> | undefined)?.type;
  return typeof type === 'string' ? type : undefined;
}

/** Infer the data shape from the series type unless the encoding overrides it. */
function detectShape(
  baseOption: Record<string, unknown>,
  encoding: Encoding,
): EncodingShape {
  if (encoding.shape) {
    return encoding.shape;
  }
  const type = firstSeriesType(baseOption);
  if (type === 'scatter' || type === 'effectScatter') {
    return 'pairs';
  }
  if (type === 'heatmap') {
    return 'matrix';
  }
  if (type === 'radar') {
    return 'radar';
  }
  if (type && NAME_VALUE_TYPES.has(type)) {
    return 'nameValue';
  }
  return 'categoryValue';
}

/**
 * Map a query result onto an echarts option using the declarative `encoding`.
 * The base `option` supplies presentation (series type, axis config); we fill in
 * `xAxis.data` and `series[].data`.
 */
export function encodeToOption(
  baseOption: Record<string, unknown>,
  encoding: Encoding,
  result: QueryResult,
): Record<string, unknown> {
  const { x, y, series } = encoding;
  const rows = result.records;
  const columns = result.columns.length
    ? result.columns
    : Object.keys(rows[0] ?? {});

  // Reconcile the encoding's labels with the actual result columns.
  const xKey = resolveColumn(x, columns, []);
  const seriesKey = series ? resolveColumn(series, columns, [xKey]) : undefined;
  const exclude = seriesKey ? [xKey, seriesKey] : [xKey];
  const metricKeys = (Array.isArray(y) ? y : [y]).map(metric =>
    resolveColumn(metric, columns, exclude),
  );

  const categories = distinct(rows.map(r => String(r[xKey])));

  const baseSeriesList = Array.isArray(baseOption.series)
    ? (baseOption.series as Array<Record<string, unknown>>)
    : [(baseOption.series as Record<string, unknown>) ?? {}];
  const withBase = (index: number, spec: Record<string, unknown>) => ({
    ...baseSeriesList[index % baseSeriesList.length],
    ...spec,
  });
  const axis = (key: 'xAxis' | 'yAxis') =>
    (baseOption[key] as Record<string, unknown>) ?? {};
  const valueAt = (cat: string, metric: string): number | null => {
    const row = rows.find(r => String(r[xKey]) === cat);
    return row ? toNumber(row[metric]) : null;
  };

  switch (detectShape(baseOption, encoding)) {
    // pie / funnel / treemap / sunburst / gauge — no axes, [{name, value}]
    case 'nameValue': {
      const metric = metricKeys[0];
      return {
        ...baseOption,
        series: [
          withBase(0, {
            name: metric,
            data: categories.map(cat => ({
              name: cat,
              value: valueAt(cat, metric),
            })),
          }),
        ],
      };
    }
    // scatter — [[xMetric, yMetric, categoryLabel]]
    case 'pairs': {
      const [mx, my = metricKeys[0]] = metricKeys;
      return {
        ...baseOption,
        xAxis: { type: 'value', ...axis('xAxis') },
        yAxis: { type: 'value', ...axis('yAxis') },
        series: [
          withBase(0, {
            name: `${mx} vs ${my}`,
            data: rows.map(r => [
              toNumber(r[mx]),
              toNumber(r[my]),
              String(r[xKey]),
            ]),
          }),
        ],
      };
    }
    // heatmap — [[xIndex, yIndex, value]] across x and the series column
    case 'matrix': {
      const metric = metricKeys[0];
      const yCats = seriesKey
        ? distinct(rows.map(r => String(r[seriesKey])))
        : [];
      return {
        ...baseOption,
        xAxis: { type: 'category', ...axis('xAxis'), data: categories },
        yAxis: { type: 'category', ...axis('yAxis'), data: yCats },
        series: [
          withBase(0, {
            name: metric,
            data: rows.map(r => [
              categories.indexOf(String(r[xKey])),
              seriesKey ? yCats.indexOf(String(r[seriesKey])) : 0,
              toNumber(r[metric]),
            ]),
          }),
        ],
      };
    }
    // radar — categories become indicators, one ring per metric
    case 'radar': {
      const values = metricKeys.flatMap(metric =>
        categories.map(cat => valueAt(cat, metric) ?? 0),
      );
      const max = Math.max(1, ...values);
      return {
        ...baseOption,
        radar: {
          ...((baseOption.radar as Record<string, unknown>) ?? {}),
          indicator: categories.map(cat => ({ name: cat, max })),
        },
        series: [
          withBase(0, {
            type: 'radar',
            data: metricKeys.map(metric => ({
              name: metric,
              value: categories.map(cat => valueAt(cat, metric) ?? 0),
            })),
          }),
        ],
      };
    }
    default:
      break;
  }

  let seriesData: Array<{ name: string; data: Array<number | null> }>;
  if (seriesKey) {
    const groups = distinct(rows.map(r => String(r[seriesKey])));
    seriesData = groups.map(group => ({
      name: group,
      data: categories.map(cat => {
        const row = rows.find(
          r => String(r[xKey]) === cat && String(r[seriesKey]) === group,
        );
        return row ? toNumber(row[metricKeys[0]]) : null;
      }),
    }));
  } else {
    seriesData = metricKeys.map(metric => ({
      name: metric,
      data: categories.map(cat => {
        const row = rows.find(r => String(r[xKey]) === cat);
        return row ? toNumber(row[metric]) : null;
      }),
    }));
  }

  const baseSeries = Array.isArray(baseOption.series)
    ? (baseOption.series as Array<Record<string, unknown>>)
    : [(baseOption.series as Record<string, unknown>) ?? {}];
  const mergedSeries = seriesData.map((s, i) => ({
    ...baseSeries[i % baseSeries.length],
    ...s,
  }));

  const baseXAxis = (baseOption.xAxis as Record<string, unknown>) ?? {
    type: 'category',
  };
  return {
    ...baseOption,
    xAxis: { ...baseXAxis, data: categories },
    series: mergedSeries,
  };
}

const FORMATTER_KINDS = new Set<Formatter['kind']>([
  'number',
  'currency',
  'percent',
  'date',
  'template',
]);

function makeFormatter(f: Formatter): (v: unknown) => string {
  switch (f.kind) {
    case 'currency': {
      const nf = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: f.currency,
        maximumFractionDigits: f.decimals ?? 0,
      });
      return v => nf.format(toNumber(v));
    }
    case 'number': {
      const nf = new Intl.NumberFormat(undefined, {
        maximumFractionDigits: f.decimals ?? 2,
      });
      return v => nf.format(toNumber(v));
    }
    case 'percent':
      return v => `${(toNumber(v) * 100).toFixed(f.decimals ?? 0)}%`;
    case 'date':
      return v => String(v);
    case 'template':
      return v => f.template.replace('{value}', String(v));
    default:
      return v => String(v);
  }
}

const isFormatterSpec = (v: unknown): v is Formatter =>
  !!v &&
  typeof v === 'object' &&
  typeof (v as { kind?: unknown }).kind === 'string' &&
  FORMATTER_KINDS.has((v as Formatter).kind);

/**
 * Convert declarative formatter objects in an option into real functions — the
 * only place functions are ever produced, and only at render time from a fixed
 * vocabulary, never from persisted strings.
 */
export function resolveFormatters(value: unknown): unknown {
  if (isFormatterSpec(value)) {
    return makeFormatter(value);
  }
  if (Array.isArray(value)) {
    return value.map(resolveFormatters);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      out[k] = resolveFormatters(v);
    });
    return out;
  }
  return value;
}
