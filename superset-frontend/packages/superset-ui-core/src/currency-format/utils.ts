/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 * either express or implied. See the License for the specific language governing permissions and limitations under the License.
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
import localeCurrency from 'locale-currency';

const getCurrencyForLocale = (locale: string): string =>
  localeCurrency.getCurrency(locale) || 'USD'; // fallback to USD if not found

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
  const urlParams = new URLSearchParams(window.location.search);
  const urlLocale = urlParams.get('locale');
  const currencySymbol = urlParams.get('currencySymbol');

  // ✅ Vérifier si on est dans un embedding
  const isEmbedding = !!(urlLocale || currencySymbol);

  // ✅ Si pas d'embedding et Superset standard, garder le comportement d'origine
  if (!isEmbedding) {
    return currencyFormat?.symbol
      ? new CurrencyFormatter({ currency: currencyFormat, d3Format })
      : getNumberFormatter(d3Format);
  }

  // ✅ Vérifier si c'est un format de pourcentage et ne rien modifier
  if (d3Format?.includes('%')) {
    return getNumberFormatter(d3Format);
  }

  try {
    const currencyCode = getCurrencyForLocale(urlLocale || 'en-US');
    const formatter = new Intl.NumberFormat(urlLocale || 'en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return new NumberFormatter({
      id: `currency-${currencyCode}`,
      formatFunc: (value: number) => {
        let formattedValue = formatter.format(value);

        // ✅ Si currencySymbol est défini, remplacer l'ancien symbole monétaire par le nouveau
        if (currencySymbol) {
          formattedValue = formattedValue.replace(
            /[\p{Sc}A-Z]{1,3}/gu, // Détecte et remplace les symboles monétaires et codes devise (ex: $, USD)
            currencySymbol,
          );
        }

        return formattedValue;
      },
      label: `Currency (${currencySymbol || currencyCode})`,
      description: `Formats numbers as currency in ${
        currencySymbol || currencyCode
      }`,
    });
  } catch (error) {
    console.error('Error creating number formatter:', error);
    return getNumberFormatter(d3Format);
  }
};
