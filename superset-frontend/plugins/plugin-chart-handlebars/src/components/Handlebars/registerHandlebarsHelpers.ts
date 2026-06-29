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

export function registerHandlebarsHelpers(): void {
  if (helpersRegistered) {
    return;
  }
  helpersRegistered = true;

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

  Handlebars.registerHelper(
    'formatNumber',
    function (number: unknown, locale = 'en-US') {
      if (typeof number !== 'number') {
        return number;
      }
      return number.toLocaleString(locale);
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

  Helpers.registerHelpers(Handlebars);
  HandlebarsGroupBy.register(Handlebars);
}

/** Reset registration state for tests. */
export function resetHandlebarsHelpersRegistration(): void {
  helpersRegistered = false;
}
