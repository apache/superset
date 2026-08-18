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
 * Handlebars helper implementations for Dynamic dashboards.
 *
 * The canonical list of helper *names* lives in handlebarsHelpers.json (the
 * single source of truth). This module provides the runtime implementations.
 * A CI test asserts that every key in the JSON has an implementation here,
 * and vice versa.
 */

export const HELPER_IMPLEMENTATIONS: Record<
  string,
  Handlebars.HelperDelegate
> = {
  formatNumber: (number: number, locale = 'en-US') => {
    if (typeof number !== 'number') return number;
    return number.toLocaleString(locale);
  },
  // Comparison
  eq: (a: unknown, b: unknown) => a === b,
  ne: (a: unknown, b: unknown) => a !== b,
  gt: (a: unknown, b: unknown) => (a as number) > (b as number),
  gte: (a: unknown, b: unknown) => (a as number) >= (b as number),
  lt: (a: unknown, b: unknown) => (a as number) < (b as number),
  lte: (a: unknown, b: unknown) => (a as number) <= (b as number),
  // Logic — Handlebars appends an options object as the last arg, so slice it off
  and: (...args: unknown[]) => args.slice(0, -1).every(Boolean),
  or: (...args: unknown[]) => args.slice(0, -1).some(Boolean),
  not: (a: unknown) => !a,
  // Arithmetic
  add: (a: unknown, b: unknown) => Number(a) + Number(b),
  subtract: (a: unknown, b: unknown) => Number(a) - Number(b),
  multiply: (a: unknown, b: unknown) => Number(a) * Number(b),
  // Fallback — use for optional theme tokens: {{fallback theme.dashboardTileBg theme.colorBgContainer}}
  fallback: (...args: unknown[]) => {
    // Last arg is Handlebars options object, skip it
    for (let i = 0; i < args.length - 1; i++) {
      if (args[i] !== undefined && args[i] !== null && args[i] !== '') return args[i];
    }
    return '';
  },
};
