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

import { getCurrencyLocale } from './currencyLocale';

export type SymbolPosition = 'prefix' | 'suffix';

const NUMERIC_PART_TYPES = new Set<Intl.NumberFormatPartTypes>([
  'integer',
  'group',
  'decimal',
  'fraction',
]);

/**
 * Memoize resolved positions by `(locale, currencyCode)`. `format` runs on a
 * hot per-value path (every currency cell of every chart), so avoid rebuilding
 * an `Intl.NumberFormat` and re-parsing the locale for repeated values.
 */
const positionCache = new Map<string, SymbolPosition>();

/**
 * Resolve where the currency symbol should be placed relative to the value.
 *
 * An explicit `prefix`/`suffix` is always honored. When the position is unset,
 * it is derived from the locale's own convention for that currency via
 * `Intl.NumberFormat` (e.g. `$1` in `en-US` is a prefix, `1 €` in `fr-FR` is a
 * suffix). Unknown currency codes fall back to `prefix`, the most common
 * convention worldwide.
 */
export function resolveSymbolPosition(
  currencyCode: string | undefined,
  symbolPosition?: string,
  locale: string = getCurrencyLocale(),
): SymbolPosition {
  if (symbolPosition === 'prefix' || symbolPosition === 'suffix') {
    return symbolPosition;
  }

  if (currencyCode) {
    const cacheKey = `${locale}|${currencyCode}`;
    const cached = positionCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    try {
      const parts = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
      }).formatToParts(1);
      const currencyIndex = parts.findIndex(part => part.type === 'currency');
      const valueIndex = parts.findIndex(part =>
        NUMERIC_PART_TYPES.has(part.type),
      );
      if (currencyIndex !== -1 && valueIndex !== -1) {
        const position = currencyIndex < valueIndex ? 'prefix' : 'suffix';
        positionCache.set(cacheKey, position);
        return position;
      }
    } catch {
      // Unknown currency or locale — fall back to the default below.
    }
  }

  return 'prefix';
}

/**
 * Combine a symbol and a formatted value according to the resolved position.
 */
export function formatWithSymbolPosition(
  symbol: string,
  value: string,
  position: SymbolPosition,
): string {
  return position === 'prefix' ? `${symbol} ${value}` : `${value} ${symbol}`;
}
