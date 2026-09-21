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
import type { dashboard as dashboardApi } from '@apache-superset/core';
import type { useTheme } from '@apache-superset/core/theme';

type DataRow = dashboardApi.DataRow;
type Theme = ReturnType<typeof useTheme>;

export interface BindContext {
  rows: DataRow[];
  theme: Theme;
}

interface BindMarker {
  $bind: {
    source: 'metric' | 'dimension' | 'theme' | 'records';
    /** `metric`/`dimension` — the row field to pull one column's values from. */
    alias?: string;
    /** `theme` — the theme token to substitute. */
    token?: string;
    /**
     * `records` — zip several row fields into one array of plain objects,
     * one per row: `{ [outputKey]: row[columnAlias], ... }`. This is the
     * shape ECharts wants for e.g. pie's `series[].data` (`{name, value}`
     * pairs), which a single flat column can't express on its own.
     */
    fields?: Record<string, string>;
    /**
     * `metric`/`dimension` only — return just the first row's value (a
     * scalar) instead of an array of every row's value. A query with no
     * `dimensions` (a single aggregate — the "big number"/gauge case) only
     * ever has one row, but `metric`/`dimension` still resolve to a
     * one-element ARRAY by default, since that's what every *other* chart
     * shape (bar/line/pie, one point per row) needs. Anywhere ECharts wants
     * a plain number/string instead — a gauge's `series[].data[].value`, a
     * `graphic[].style.text` label — set `single: true` to get that one
     * value unwrapped, rather than `[value]`.
     */
    single?: boolean;
  };
}

const BIND_SOURCES = new Set(['metric', 'dimension', 'theme', 'records']);

function isBindMarker(value: unknown): value is BindMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    '$bind' in (value as Record<string, unknown>)
  );
}

/**
 * True for the mistake of writing a `$bind` marker's *inner* shape —
 * `{"source": "records", "fields": {...}}` — directly in place of a value,
 * omitting the `"$bind"` wrapper key itself. Easy to make (the inner shape
 * is what everything actually reads), and costly to miss: unwrapped, it
 * isn't a bind marker at all as far as `resolveValue` is concerned, so it
 * passes straight through as a literal object — a hard crash later if the
 * spot expected an array (e.g. `series[].data`), or a silently wrong value
 * if it didn't (e.g. a theme color quietly becoming `{source, token}`
 * instead of the color string it names).
 */
function looksLikeUnwrappedBind(
  value: Record<string, unknown>,
): value is BindMarker['$bind'] {
  return typeof value.source === 'string' && BIND_SOURCES.has(value.source);
}

/**
 * A malformed `$bind` marker (a missing `alias`/`fields`/`token`, or an
 * unrecognized `source`) used to resolve to `undefined` — which, spliced
 * into e.g. a chart's `series[].data`, doesn't fail here at all. It fails
 * much later, inside ECharts' own `setOption`, as a generic
 * "series.data ... must be an array" console error with no indication that
 * the actual cause was an incomplete `$bind` several layers up. Throwing
 * here instead — during `resolveBindings`, called from `ChartWidget`'s
 * render — gets caught by the `ErrorBoundary` already wrapping every widget
 * (see `WidgetView`) and reported as this specific widget's error,
 * naming the exact marker that was incomplete.
 */
function resolveBind(bind: BindMarker['$bind'], ctx: BindContext): unknown {
  if (bind.source === 'theme') {
    if (!bind.token) {
      throw new Error('$bind with source "theme" is missing "token"');
    }
    return (ctx.theme as unknown as Record<string, unknown>)[bind.token];
  }
  if (bind.source === 'metric' || bind.source === 'dimension') {
    if (!bind.alias) {
      throw new Error(`$bind with source "${bind.source}" is missing "alias"`);
    }
    const values = ctx.rows.map(row => row[bind.alias as string]);
    return bind.single ? values[0] : values;
  }
  if (bind.source === 'records') {
    if (!bind.fields || Object.keys(bind.fields).length === 0) {
      throw new Error('$bind with source "records" is missing "fields"');
    }
    const { fields } = bind;
    return ctx.rows.map(row => {
      const record: Record<string, unknown> = {};
      Object.entries(fields).forEach(([outputKey, columnAlias]) => {
        record[outputKey] = row[columnAlias];
      });
      return record;
    });
  }
  throw new Error(
    `Unknown $bind source: "${(bind as { source: string }).source}"`,
  );
}

// ECharts option keys documented as accepting *only* a JavaScript function
// (no string-template alternative the way `formatter` has) — a JSON
// tool-call argument can never supply a function, so any value found under
// one of these keys is unconditionally wrong, not just wrong in some cases.
// Left unchecked, this fails deep inside ECharts' own `setOption` as e.g.
// "valueFormatter is not a function," with nothing pointing back at the
// AI-authored option key that caused it.
const FUNCTION_ONLY_KEYS = new Set(['valueFormatter', 'labelLayout']);

function resolveValue(value: unknown, ctx: BindContext): unknown {
  if (Array.isArray(value)) {
    return value.map(item => resolveValue(item, ctx));
  }
  if (isBindMarker(value)) {
    return resolveBind(value.$bind, ctx);
  }
  if (value !== null && typeof value === 'object') {
    if (looksLikeUnwrappedBind(value as Record<string, unknown>)) {
      throw new Error(
        `Found a $bind object without its "$bind" wrapper: ${JSON.stringify(value)} — ` +
          `did you mean {"$bind": ${JSON.stringify(value)}}?`,
      );
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, v]) => {
        if (FUNCTION_ONLY_KEYS.has(key)) {
          throw new Error(
            `"${key}" must be a JavaScript function in ECharts, which a JSON-authored ` +
              'option can never provide. Remove it and use a string-template field ' +
              'instead where one exists (e.g. "formatter" on tooltip/axisLabel/label, ' +
              'not "valueFormatter" — a string like "{b}: ${c}" works directly on ' +
              '"formatter").',
          );
        }
        return [key, resolveValue(v, ctx)];
      }),
    );
  }
  return value;
}

/**
 * Recursively walks a near-raw ECharts `option` object and replaces every
 * `{"$bind": {...}}` marker with the real value it references — query
 * results or a theme token (decision 12 of the design doc's unified `$bind`
 * construct). Everything else in the tree passes through unchanged, so an
 * AI-authored option can mix literal ECharts config with bound values
 * anywhere a literal would otherwise go.
 */
export function resolveBindings(
  echartsOptions: Record<string, unknown>,
  ctx: BindContext,
): Record<string, unknown> {
  return resolveValue(echartsOptions, ctx) as Record<string, unknown>;
}
