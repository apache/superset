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
import { t, tn } from '@apache-superset/core/translation';
import {
  AUTO_CURRENCY_SYMBOL,
  CurrencyFormatter,
  getNumberFormatter,
} from '@superset-ui/core';
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';
import Handlebars, { HelperOptions } from 'handlebars';
import { isPlainObject } from 'lodash';
import Helpers from 'just-handlebars-helpers';
import HandlebarsGroupBy from 'handlebars-group-by';

let helpersRegistered = false;

function isHandlebarsOptions(value: unknown): value is HelperOptions {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('hash' in value || 'fn' in value || 'data' in value)
  );
}

function getPositionalArgs(args: unknown[]): unknown[] {
  if (args.length === 0) {
    return [];
  }
  const lastArg = args[args.length - 1];
  return isHandlebarsOptions(lastArg) ? args.slice(0, -1) : args;
}

function parseNumericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const num = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(num) ? null : num;
}

function getRowData(
  context: unknown,
): Record<string, string | number | boolean | null | undefined> | undefined {
  if (typeof context === 'object' && context !== null) {
    return context as Record<
      string,
      string | number | boolean | null | undefined
    >;
  }
  return undefined;
}

export function registerHandlebarsHelpers(): void {
  if (helpersRegistered) {
    return;
  }
  helpersRegistered = true;

  Helpers.registerHelpers(Handlebars);
  HandlebarsGroupBy.register(Handlebars);

  // Register Superset helpers after third-party helpers to avoid overrides.
  // usage: {{ dateFormat my_date format="MMMM YYYY" }}
  Handlebars.registerHelper('dateFormat', function (context, block) {
    const f = block.hash.format || 'YYYY-MM-DD';
    return dayjs(context).format(f);
  });

  // usage: {{stringify myObj}}
  Handlebars.registerHelper('stringify', (obj: unknown, obj2: unknown) => {
    if (obj2 === undefined) {
      throw new Error('Please call with an object. Example: `stringify myObj`');
    }
    return isPlainObject(obj) ? JSON.stringify(obj) : String(obj);
  });

  // usage: {{formatNumber value format=",.2f"}} or {{formatNumber value locale="en-US"}}
  Handlebars.registerHelper(
    'formatNumber',
    function (number: unknown, block: HelperOptions) {
      const num = parseNumericValue(number);
      if (num === null) {
        return number === null || number === undefined || number === ''
          ? ''
          : String(number);
      }

      const format = block.hash.format as string | undefined;
      const locale = block.hash.locale as string | undefined;

      if (format) {
        return String(getNumberFormatter(format)(num));
      }

      if (locale) {
        return num.toLocaleString(locale);
      }

      return String(getNumberFormatter()(num));
    },
  );

  // usage: {{formatCurrency value format=",.2f" code=currency_code_col}}
  // usage: {{formatCurrency value currencyColumn="currency_code_col"}}
  Handlebars.registerHelper(
    'formatCurrency',
    function (
      this: Record<string, string | number | boolean | null | undefined>,
      value: unknown,
      block: HelperOptions,
    ) {
      const num = parseNumericValue(value);
      if (num === null) {
        return '';
      }

      const format = (block.hash.format as string) || ',.2f';
      const position =
        (block.hash.position as 'prefix' | 'suffix' | undefined) || 'prefix';
      const rowData = getRowData(this);
      const currencyColumn = block.hash.currencyColumn as string | undefined;
      const code = block.hash.code as string | undefined;

      if (currencyColumn && rowData) {
        const formatter = new CurrencyFormatter({
          d3Format: format,
          currency: {
            symbol: AUTO_CURRENCY_SYMBOL,
            symbolPosition: position,
          },
        });
        return formatter(num, rowData, currencyColumn);
      }

      if (code) {
        const formatter = new CurrencyFormatter({
          d3Format: format,
          currency: {
            symbol: code,
            symbolPosition: position,
          },
        });
        return formatter(num);
      }

      return String(getNumberFormatter(format)(num));
    },
  );

  // usage: {{parseJson jsonString}}
  Handlebars.registerHelper('parseJson', (jsonString: string) => {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      if (error instanceof Error) {
        error.message = `Invalid JSON string: ${error.message}`;
        throw error;
      }
      throw new Error(`Invalid JSON string: ${String(error)}`);
    }
  });

  // usage: {{t "Conversion Rate"}} or {{t labelKey}}
  Handlebars.registerHelper('t', function (...args: unknown[]) {
    const positional = getPositionalArgs(args);
    const key = positional[0];
    if (key === undefined || key === null) {
      return '';
    }
    return t(String(key), ...positional.slice(1));
  });

  // usage: {{tn "item" count}} for pluralized strings
  Handlebars.registerHelper('tn', function (...args: unknown[]) {
    const positional = getPositionalArgs(args);
    const key = positional[0];
    if (key === undefined || key === null) {
      return '';
    }
    return tn(String(key), ...positional.slice(1));
  });
}

/** Reset registration state for tests. */
export function resetHandlebarsHelpersRegistration(): void {
  helpersRegistered = false;
}
