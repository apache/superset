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

import { compileTemplate, isTemplate } from './template';

export type DataRow = Record<string, unknown>;

export interface BindContext {
  rows: DataRow[];
  theme: Record<string, unknown>;
}

interface Bind {
  source: 'metric' | 'dimension' | 'theme' | 'records' | 'tuples';
  alias?: string;
  token?: string;
  fields?: Record<string, string> | string[];
  single?: boolean;
}

const BIND_SOURCES = new Set([
  'metric',
  'dimension',
  'theme',
  'records',
  'tuples',
]);
// Where a `$template` may stand in for a function: the hooks whose string
// is drawn as text (on the canvas, or in a tooltip forced to rich text).
// Nowhere else, because other string-returning hooks, such as the data
// view's `optionToContent`, are injected as HTML. `valueFormatter` takes
// nothing but a function; nothing stands in for `labelLayout`, which
// returns a layout object.
const TEMPLATE_KEYS = new Set(['formatter', 'valueFormatter']);
const TEMPLATE_ONLY_KEYS = new Set(['valueFormatter']);
const FUNCTION_ONLY_KEYS = new Set(['labelLayout']);
// Opened as URLs by ECharts on click.
const URL_KEYS = new Set(['link', 'sublink']);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Keys that would reach the object prototype instead of the record.
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// A dotted key (`label.fontSize`) nests, so a column can drive a per-item
// style.
function setPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const keys = path.split('.');
  if (keys.some(key => UNSAFE_KEYS.has(key))) {
    throw new Error(`"${path}" is not a valid field path`);
  }
  let node = target;
  keys.slice(0, -1).forEach(key => {
    if (!Object.hasOwn(node, key) || !isObject(node[key])) node[key] = {};
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
  if (bind.source === 'tuples') {
    // Array-shaped data items (themeRiver, candlestick, boxplot, heatmap…).
    const columns = bind.fields;
    if (!Array.isArray(columns) || columns.length === 0) {
      throw new Error('$bind with source "tuples" needs "fields": [<columns>]');
    }
    return ctx.rows.map(row => columns.map(column => row[column]));
  }
  if (bind.source === 'records') {
    const fields = bind.fields ?? {};
    if (Array.isArray(fields) || Object.keys(fields).length === 0) {
      throw new Error(
        '$bind with source "records" needs "fields": {<key>: <column>}',
      );
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
  if (isTemplate(value)) {
    throw new Error(
      `A $template is only accepted as a "formatter" or "valueFormatter"`,
    );
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
          throw new Error(`"${key}" must be a function in ECharts`);
        }
        if (TEMPLATE_ONLY_KEYS.has(key) && !isTemplate(item)) {
          throw new Error(
            `"${key}" must be a function in ECharts; use {"$template": "..."} instead`,
          );
        }
        if (TEMPLATE_KEYS.has(key) && isTemplate(item)) {
          return [key, compileTemplate(item.$template)];
        }
        return [key, resolveValue(item, ctx)];
      }),
  );
}

const RICH_TEXT = { renderMode: 'richText' } as const;

const asRichText = (tooltip: unknown): unknown => {
  if (Array.isArray(tooltip)) return tooltip.map(asRichText);
  return isObject(tooltip) ? { ...tooltip, ...RICH_TEXT } : tooltip;
};

/**
 * Every `tooltip` at any depth renders as rich text. ECharts reads the
 * tooltip component from `baseOption`, `options[]` and `media[].option` as
 * well as the root, so guarding the root alone leaves HTML formatters live.
 */
const forceRichText = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(forceRichText);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      key === 'tooltip' ? asRichText(forceRichText(item)) : forceRichText(item),
    ]),
  );
};

const withTooltip = (
  option: Record<string, unknown>,
): Record<string, unknown> => ({
  ...option,
  tooltip: option.tooltip ?? { ...RICH_TEXT },
});

/**
 * An ECharts option with its `$bind` markers replaced by query results or
 * theme tokens. Tooltips render as rich text rather than HTML, so strings in
 * the option can't inject markup into viewers' pages.
 */
export function resolveOption(
  option: Record<string, unknown>,
  ctx: BindContext,
): Record<string, unknown> {
  const resolved = forceRichText(resolveValue(option, ctx)) as Record<
    string,
    unknown
  >;
  const withRoot = withTooltip(resolved);
  return isObject(withRoot.baseOption)
    ? { ...withRoot, baseOption: withTooltip(withRoot.baseOption) }
    : withRoot;
}
