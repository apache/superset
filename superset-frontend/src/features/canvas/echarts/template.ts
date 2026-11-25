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

/**
 * @fileoverview Handlebars templates standing in for ECharts formatter
 * functions, which a JSON option cannot carry.
 *
 * `{"$template": "{{name}}: {{formatNumber value ',.2f'}}"}` anywhere a
 * `formatter` (or `valueFormatter`) goes compiles to the function ECharts
 * expects. The same syntax the deck.gl tooltips use, so one grammar covers
 * both; the output is plain text that ECharts draws as rich text, never HTML,
 * so no escaping is applied and none is needed.
 */
import Handlebars from 'handlebars';
import { getNumberFormatter, getTimeFormatter } from '@superset-ui/core';

export interface Template {
  $template: string;
}

export type Formatter = (...args: unknown[]) => string;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isTemplate = (value: unknown): value is Template =>
  isObject(value) && typeof value.$template === 'string';

/** Own environment: the global one carries other plugins' helpers. */
const env = Handlebars.create();

env.registerHelper('formatNumber', (value: unknown, format?: unknown) =>
  typeof value === 'number'
    ? getNumberFormatter(typeof format === 'string' ? format : undefined)(value)
    : String(value ?? ''),
);

env.registerHelper('formatDate', (value: unknown, format?: unknown) => {
  if (value === null || value === undefined || value === '') return '';
  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime())
    ? String(value)
    : getTimeFormatter(typeof format === 'string' ? format : undefined)(date);
});

env.registerHelper('default', (value: unknown, fallback: unknown) =>
  value === null || value === undefined || value === '' ? fallback : value,
);

/**
 * What the template sees. ECharts hands a formatter one params object per
 * item (item trigger, labels), an array of them (axis trigger), or a bare
 * value with its index (axis labels, `valueFormatter`). Every shape lands as
 * the same record: the first item's fields at the top level, every item under
 * `items`, so `{{name}}` works everywhere and `{{#each items}}` lists a shared
 * axis.
 */
function contextOf(args: unknown[]): Record<string, unknown> {
  const [params, second] = args;
  if (Array.isArray(params)) {
    const [first] = params;
    return { ...(isObject(first) ? first : {}), items: params };
  }
  if (isObject(params)) return { ...params, items: [params] };
  return { value: params, index: second, items: [] };
}

/**
 * The function ECharts calls. A template that fails to parse throws here,
 * when the option is built, so the widget reports it; one that fails while
 * drawing returns the error as the text, so a bad helper argument shows in
 * the tooltip rather than breaking the hover.
 */
export function compileTemplate(source: string): Formatter {
  // `compile` parses lazily, on the first call; parse now so a syntax error
  // surfaces here.
  env.parse(source);
  const template = env.compile(source, { noEscape: true, strict: false });
  return (...args) => {
    try {
      return template(contextOf(args));
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };
}
