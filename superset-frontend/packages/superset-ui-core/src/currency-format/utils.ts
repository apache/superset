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
  Currency,
  CurrencyFormatter,
  ensureIsArray,
  getNumberFormatter,
  isSavedMetric,
  QueryFormMetric,
  ValueFormatter,
} from '@superset-ui/core';
import { normalizeCurrency, hasMixedCurrencies } from './CurrencyFormatter';

/**
 * Analyze data to detect if it contains single or mixed currencies.
 * Used by AUTO mode to determine whether to show currency symbols or neutral formatting.
 *
 * @param data - Array of data records from chart query results
 * @param currencyColumn - Name of the column containing currency codes/symbols
 * @returns Normalized ISO 4217 currency code if single currency detected, null otherwise
 *
 * @example
 * // Single currency detected
 * analyzeCurrencyInData([{curr: 'USD'}, {curr: 'usd'}], 'curr') // 'USD'
 *
 * @example
 * // Mixed currencies detected
 * analyzeCurrencyInData([{curr: 'USD'}, {curr: 'EUR'}], 'curr') // null
 */
export const analyzeCurrencyInData = (
  data: Record<string, any>[],
  currencyColumn: string | undefined,
): string | null => {
  if (!currencyColumn || !data || data.length === 0) {
    return null;
  }

  // Extract all currency values from the data
  const currencies = data
    .map(row => row[currencyColumn])
    .filter(val => val !== null && val !== undefined);

  if (currencies.length === 0) {
    return null;
  }

  // Use existing hasMixedCurrencies utility
  if (hasMixedCurrencies(currencies)) {
    return null; // Mixed currencies - use neutral format
  }

  // Single currency detected - normalize and return it
  return normalizeCurrency(currencies[0]);
};

export const buildCustomFormatters = (
  metrics: QueryFormMetric | QueryFormMetric[] | undefined,
  savedCurrencyFormats: Record<string, Currency>,
  savedColumnFormats: Record<string, string>,
  d3Format: string | undefined,
  currencyFormat: Currency | undefined | null,
  data?: Record<string, any>[],
  currencyCodeColumn?: string,
) => {
  const metricsArray = ensureIsArray(metrics);

  // Detect currency for AUTO mode
  let resolvedCurrency = currencyFormat;
  if (currencyFormat?.symbol === 'AUTO' && data && currencyCodeColumn) {
    const detectedCurrency = analyzeCurrencyInData(data, currencyCodeColumn);
    if (detectedCurrency) {
      // Single currency: use it with same position as configured
      resolvedCurrency = {
        symbol: detectedCurrency,
        symbolPosition: currencyFormat.symbolPosition,
      };
    } else {
      // Mixed currencies: use neutral format (explicitly set to null to prevent fallback)
      resolvedCurrency = null;
    }
  }

  return metricsArray.reduce((acc, metric) => {
    if (isSavedMetric(metric)) {
      const actualD3Format = d3Format ?? savedColumnFormats[metric];
      // null means "explicitly no currency" (from AUTO mixed detection), don't fall back
      const actualCurrencyFormat =
        resolvedCurrency === null
          ? undefined
          : resolvedCurrency?.symbol
            ? resolvedCurrency
            : savedCurrencyFormats[metric];
      return actualCurrencyFormat?.symbol
        ? {
            ...acc,
            [metric]: new CurrencyFormatter({
              d3Format: actualD3Format,
              currency: actualCurrencyFormat,
            }),
          }
        : {
            ...acc,
            [metric]: getNumberFormatter(actualD3Format),
          };
    }
    return acc;
  }, {});
};

export const getCustomFormatter = (
  customFormatters: Record<string, ValueFormatter>,
  metrics: QueryFormMetric | QueryFormMetric[] | undefined,
  key?: string,
) => {
  const metricsArray = ensureIsArray(metrics);
  if (metricsArray.length === 1 && isSavedMetric(metricsArray[0])) {
    return customFormatters[metricsArray[0]];
  }
  return key ? customFormatters[key] : undefined;
};

export const getValueFormatter = (
  metrics: QueryFormMetric | QueryFormMetric[] | undefined,
  savedCurrencyFormats: Record<string, Currency>,
  savedColumnFormats: Record<string, string>,
  d3Format: string | undefined,
  currencyFormat: Currency | undefined,
  key?: string,
  data?: Record<string, any>[],
  currencyCodeColumn?: string,
  detectedCurrency?: string | null,
) => {
  // Detect currency for AUTO mode
  let resolvedCurrency: Currency | undefined | null = currencyFormat;
  if (currencyFormat?.symbol === 'AUTO') {
    // Priority 1: Use backend-detected currency if available
    if (detectedCurrency !== undefined) {
      if (detectedCurrency) {
        // Single currency detected by backend
        resolvedCurrency = {
          symbol: detectedCurrency,
          symbolPosition: currencyFormat.symbolPosition,
        };
      } else {
        // Mixed currencies (null from backend) - use neutral format
        resolvedCurrency = null;
      }
    }
    // Priority 2: Fallback to frontend data analysis (for Table charts with currency column in data)
    else if (data && currencyCodeColumn) {
      const frontendDetectedCurrency = analyzeCurrencyInData(
        data,
        currencyCodeColumn,
      );
      if (frontendDetectedCurrency) {
        resolvedCurrency = {
          symbol: frontendDetectedCurrency,
          symbolPosition: currencyFormat.symbolPosition,
        };
      } else {
        resolvedCurrency = null;
      }
    }
    // Priority 3: No detection possible - use neutral format
    else {
      resolvedCurrency = null;
    }
  }

  const customFormatter = getCustomFormatter(
    buildCustomFormatters(
      metrics,
      savedCurrencyFormats,
      savedColumnFormats,
      d3Format,
      resolvedCurrency,
    ),
    metrics,
    key,
  );

  if (customFormatter) {
    return customFormatter;
  }
  // null means neutral format (don't use currency), undefined means try currency if available
  if (resolvedCurrency === null) {
    return getNumberFormatter(d3Format);
  }
  if (resolvedCurrency?.symbol) {
    return new CurrencyFormatter({ currency: resolvedCurrency, d3Format });
  }
  return getNumberFormatter(d3Format);
};
