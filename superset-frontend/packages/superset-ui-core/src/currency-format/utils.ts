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
import { RowData, RowDataValue } from './types';
import { AUTO_CURRENCY_SYMBOL } from './CurrencyFormats';

export const analyzeCurrencyInData = (
  data: RowData[],
  currencyColumn: string | undefined,
): string | null => {
  if (!currencyColumn || !data || data.length === 0) {
    return null;
  }

  const currencies: RowDataValue[] = data
    .map(row => row[currencyColumn])
    .filter(val => val !== null && val !== undefined);

  if (currencies.length === 0) {
    return null;
  }

  if (hasMixedCurrencies(currencies)) {
    return null;
  }

  return normalizeCurrency(currencies[0]);
};

export const resolveAutoCurrency = (
  currencyFormat: Currency | undefined,
  backendDetected: string | null | undefined,
  data?: RowData[],
  currencyCodeColumn?: string,
): Currency | undefined | null => {
  if (currencyFormat?.symbol !== AUTO_CURRENCY_SYMBOL) return currencyFormat;

  const detectedCurrency =
    backendDetected ??
    (data && currencyCodeColumn
      ? analyzeCurrencyInData(data, currencyCodeColumn)
      : null);

  if (detectedCurrency) {
    return {
      symbol: detectedCurrency,
      symbolPosition: currencyFormat.symbolPosition,
    };
  }
  return null; // Mixed currencies
};

const getEffectiveCurrencyFormat = (
  resolvedCurrencyFormat: Currency | undefined | null,
  savedFormat: Currency | undefined,
): Currency | undefined => {
  if (resolvedCurrencyFormat === null) {
    return undefined;
  }
  if (resolvedCurrencyFormat?.symbol) {
    return resolvedCurrencyFormat;
  }
  return savedFormat;
};

export const buildCustomFormatters = (
  metrics: QueryFormMetric | QueryFormMetric[] | undefined,
  savedCurrencyFormats: Record<string, Currency>,
  savedColumnFormats: Record<string, string>,
  d3Format: string | undefined,
  currencyFormat: Currency | undefined | null,
  data?: RowData[],
  currencyCodeColumn?: string,
) => {
  const metricsArray = ensureIsArray(metrics);

  let resolvedCurrencyFormat = currencyFormat;
  if (
    currencyFormat?.symbol === AUTO_CURRENCY_SYMBOL &&
    data &&
    currencyCodeColumn
  ) {
    const detectedCurrency = analyzeCurrencyInData(data, currencyCodeColumn);
    if (detectedCurrency) {
      resolvedCurrencyFormat = {
        symbol: detectedCurrency,
        symbolPosition: currencyFormat.symbolPosition,
      };
    } else {
      resolvedCurrencyFormat = null;
    }
  }

  return metricsArray.reduce((acc, metric) => {
    if (isSavedMetric(metric)) {
      const actualD3Format = d3Format ?? savedColumnFormats[metric];
      const actualCurrencyFormat = getEffectiveCurrencyFormat(
        resolvedCurrencyFormat,
        savedCurrencyFormats[metric],
      );
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
  data?: RowData[],
  currencyCodeColumn?: string,
  detectedCurrency?: string | null,
) => {
  let resolvedCurrencyFormat: Currency | undefined | null = currencyFormat;
  if (currencyFormat?.symbol === AUTO_CURRENCY_SYMBOL) {
    // Use backend-detected currency, or fallback to frontend analysis
    if (detectedCurrency !== undefined) {
      resolvedCurrencyFormat = detectedCurrency
        ? {
            symbol: detectedCurrency,
            symbolPosition: currencyFormat.symbolPosition,
          }
        : null;
    } else if (data && currencyCodeColumn) {
      const frontendDetected = analyzeCurrencyInData(data, currencyCodeColumn);
      resolvedCurrencyFormat = frontendDetected
        ? {
            symbol: frontendDetected,
            symbolPosition: currencyFormat.symbolPosition,
          }
        : null;
    } else {
      resolvedCurrencyFormat = null;
    }
  }

  const customFormatter = getCustomFormatter(
    buildCustomFormatters(
      metrics,
      savedCurrencyFormats,
      savedColumnFormats,
      d3Format,
      resolvedCurrencyFormat,
    ),
    metrics,
    key,
  );

  if (customFormatter) {
    return customFormatter;
  }
  if (resolvedCurrencyFormat === null) {
    return getNumberFormatter(d3Format);
  }
  if (resolvedCurrencyFormat?.symbol) {
    return new CurrencyFormatter({
      currency: resolvedCurrencyFormat,
      d3Format,
    });
  }
  return getNumberFormatter(d3Format);
};
