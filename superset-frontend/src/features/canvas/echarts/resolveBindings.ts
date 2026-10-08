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

export type DataRow = Record<string, unknown>;

export interface BindContext {
  rows: DataRow[];
  theme: Record<string, unknown>;
}

interface Bind {
  source: 'metric' | 'dimension' | 'theme' | 'records';
  alias?: string;
  token?: string;
  fields?: Record<string, string>;
  single?: boolean;
}

const BIND_SOURCES = new Set(['metric', 'dimension', 'theme', 'records']);
// ECharts only accepts functions here, which a JSON option can't carry.
const FUNCTION_ONLY_KEYS = new Set(['valueFormatter', 'labelLayout']);
// Opened as URLs by ECharts on click.
const URL_KEYS = new Set(['link', 'sublink']);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// A dotted key (`label.fontSize`) nests, so a column can drive a per-item
// style.
function setPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const keys = path.split('.');
  let node = target;
  keys.slice(0, -1).forEach(key => {
    if (!isObject(node[key])) node[key] = {};
    node = node[key] as Record<string, unknown>;
  });
  node[keys[keys.length - 1]] = value;
}

function resolveBind(bind: Bind, ctx: BindContext): unknown {
  if (bind.source === 'theme') {
    if (!bind.token) throw new Error('$bind with source "theme" needs "token"');
    return ctx.theme[bind.token];
  }
  if (bind.source === 'metric' || bind.source === 'dimension') {
    if (!bind.alias) {
      throw new Error(`$bind with source "${bind.source}" needs "alias"`);
    }
    const values = ctx.rows.map(row => row[bind.alias as string]);
    return bind.single ? values[0] : values;
  }
  if (bind.source === 'records') {
    const fields = bind.fields ?? {};
    if (Object.keys(fields).length === 0) {
      throw new Error('$bind with source "records" needs "fields"');
    }
    return ctx.rows.map(row => {
      const record: Record<string, unknown> = {};
      Object.entries(fields).forEach(([key, column]) =>
        setPath(record, key, row[column]),
      );
      return record;
    });
  }
  throw new Error(`Unknown $bind source "${bind.source}"`);
}

// Drops URL keys at every depth, including in objects built from query rows.
function stripUrlKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUrlKeys);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !URL_KEYS.has(key))
      .map(([key, item]) => [key, stripUrlKeys(item)]),
  );
}

function resolveValue(value: unknown, ctx: BindContext): unknown {
  if (Array.isArray(value)) return value.map(item => resolveValue(item, ctx));
  if (!isObject(value)) return value;
  if ('$bind' in value) {
    return stripUrlKeys(resolveBind(value.$bind as Bind, ctx));
  }
  if (typeof value.source === 'string' && BIND_SOURCES.has(value.source)) {
    throw new Error(
      `Found a $bind object without its "$bind" wrapper: ${JSON.stringify(value)}`,
    );
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !URL_KEYS.has(key))
      .map(([key, item]) => {
        if (FUNCTION_ONLY_KEYS.has(key)) {
          throw new Error(
            `"${key}" must be a function in ECharts; use a "formatter" string instead`,
          );
        }
        return [key, resolveValue(item, ctx)];
      }),
  );
}

/**
 * An ECharts option with its `$bind` markers replaced by query results or
 * theme tokens. Tooltips render as rich text rather than HTML, so strings in
 * the option can't inject markup into viewers' pages.
 */
export function resolveOption(
  option: Record<string, unknown>,
  ctx: BindContext,
): Record<string, unknown> {
  const resolved = resolveValue(option, ctx) as Record<string, unknown>;
  const tooltips = Array.isArray(resolved.tooltip)
    ? resolved.tooltip
    : [resolved.tooltip ?? {}];
  const safe = tooltips.map(tooltip => ({
    ...(isObject(tooltip) ? tooltip : {}),
    renderMode: 'richText',
  }));
  return {
    ...resolved,
    tooltip: Array.isArray(resolved.tooltip) ? safe : safe[0],
  };
}
