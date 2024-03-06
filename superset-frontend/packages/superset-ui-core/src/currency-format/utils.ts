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
      return actualCurrencyFormat
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
) => {
  const customFormatter = getCustomFormatter(
    buildCustomFormatters(
      metrics,
      savedCurrencyFormats,
      savedColumnFormats,
      d3Format,
      currencyFormat,
    ),
    metrics,
    key,
  );

  if (customFormatter) {
    return customFormatter;
  }
  if (currencyFormat?.symbol) {
    return new CurrencyFormatter({ currency: currencyFormat, d3Format });
  }
  return getNumberFormatter(d3Format);
};
