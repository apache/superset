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
  NumberFormatter,
} from '@superset-ui/core';
import countryToCurrencyRaw from 'country-to-currency';

const countryToCurrency = countryToCurrencyRaw as Record<string, string>;
const getCurrencyForLocale = (locale: string): string => {
  const region = new Intl.Locale(locale).maximize().region ?? 'US';
  return countryToCurrency[region] ?? 'USD';
};

export const buildCustomFormatters = (
  metrics: QueryFormMetric | QueryFormMetric[] | undefined,
  savedCurrencyFormats: Record<string, Currency>,
  savedColumnFormats: Record<string, string>,
  d3Format: string | undefined,
  currencyFormat: Currency | undefined,
) => {
  const metricsArray = ensureIsArray(metrics);
  return metricsArray.reduce((acc, metric) => {
    if (isSavedMetric(metric)) {
      const actualD3Format = d3Format ?? savedColumnFormats[metric];
      const actualCurrencyFormat = currencyFormat?.symbol
        ? currencyFormat
        : savedCurrencyFormats[metric];

      return {
        ...acc,
        [metric]: actualCurrencyFormat
          ? new CurrencyFormatter({
              d3Format: actualD3Format,
              currency: actualCurrencyFormat,
            })
          : getNumberFormatter(actualD3Format),
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
): ValueFormatter => {
  const params = new URLSearchParams(window.location.search);
  const hasLocaleParam = params.has('locale') && !!params.get('locale');
  const hasSymbolParam =
    params.has('currencySymbol') && !!params.get('currencySymbol');
  const isEmbedding = hasLocaleParam || hasSymbolParam;

  if (!isEmbedding) {
    const fmtD3 = d3Format ?? (key ? savedColumnFormats[key] : undefined);

    const fmtCurrency =
      (currencyFormat?.symbol ? currencyFormat : undefined) ??
      (key ? savedCurrencyFormats[key] : undefined);

    if (fmtCurrency?.symbol) {
      return new CurrencyFormatter({
        currency: fmtCurrency,
        d3Format: fmtD3,
      });
    }
    return getNumberFormatter(fmtD3);
  }

  const urlLocale = params.get('locale')!;
  const currencySymbol = params.get('currencySymbol')!;

  if (d3Format?.includes('%')) {
    return getNumberFormatter(d3Format);
  }

  try {
    const currencyCode = getCurrencyForLocale(urlLocale);
    const native = new Intl.NumberFormat(urlLocale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return new NumberFormatter({
      id: `currency-${currencyCode}`,
      formatFunc: (value: number) => {
        let formatted = native.format(value);
        if (currencySymbol) {
          formatted = formatted.replace(/[\p{Sc}A-Z]{1,3}/gu, currencySymbol);
        }
        return formatted;
      },
      label: `Currency (${currencySymbol || currencyCode})`,
      description: `Formats numbers as currency in ${currencySymbol || currencyCode}`,
    });
  } catch {
    return getNumberFormatter(d3Format);
  }
};
