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

import { ExtensibleFunction } from '../models';
import { getNumberFormatter, NumberFormats } from '../number-format';
import { Currency } from '../query';
import { RowData, RowDataValue } from './types';
import { AUTO_CURRENCY_SYMBOL, ISO_4217_REGEX } from './CurrencyFormats';

/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */

interface CurrencyFormatterConfig {
  d3Format?: string;
  currency: Currency;
  locale?: string;
}

interface CurrencyFormatter {
  (
    value: number | null | undefined,
    rowData?: RowData,
    currencyColumn?: string,
  ): string;
}

export const getCurrencySymbol = (currency: Partial<Currency>) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.symbol,
  })
    .formatToParts(1)
    .find(x => x.type === 'currency')?.value;

export function normalizeCurrency(value: RowDataValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toUpperCase();

  return ISO_4217_REGEX.test(normalized) ? normalized : null;
}

export function hasMixedCurrencies(currencies: RowDataValue[]): boolean {
  let first: string | null = null;

  for (const c of currencies) {
    const normalized = normalizeCurrency(c);
    if (normalized === null) continue;

    if (first === null) {
      first = normalized;
    } else if (normalized !== first) {
      return true;
    }
  }

  return false;
}

class CurrencyFormatter extends ExtensibleFunction {
  d3Format: string;

  locale: string;

  currency: Currency;

  constructor(config: CurrencyFormatterConfig) {
    super((value: number, rowData?: RowData, currencyColumn?: string) =>
      this.format(value, rowData, currencyColumn),
    );
    this.d3Format = config.d3Format || NumberFormats.SMART_NUMBER;
    this.currency = config.currency;
    this.locale = config.locale || 'en-US';
  }

  hasValidCurrency() {
    return Boolean(this.currency?.symbol);
  }

  getNormalizedD3Format() {
    return this.d3Format.replace(/\$/g, '');
  }

  normalizeForCurrency(value: string) {
    return value.replace(/%/g, '');
  }

  format(value: number, rowData?: RowData, currencyColumn?: string): string {
    const formattedValue = getNumberFormatter(this.getNormalizedD3Format())(
      value,
    );

    const isAutoMode = this.currency?.symbol === AUTO_CURRENCY_SYMBOL;

    if (!this.hasValidCurrency() && !isAutoMode) {
      return formattedValue as string;
    }

    // Remove % signs from formatted value for currency display
    const normalizedValue = this.normalizeForCurrency(formattedValue);

    if (isAutoMode) {
      if (rowData && currencyColumn && rowData[currencyColumn]) {
        const rawCurrency = rowData[currencyColumn];
        const normalizedCurrency = normalizeCurrency(rawCurrency);

        if (normalizedCurrency) {
          try {
            const symbol = getCurrencySymbol({ symbol: normalizedCurrency });
            if (symbol) {
              if (this.currency.symbolPosition === 'prefix') {
                return `${symbol} ${normalizedValue}`;
              } else if (this.currency.symbolPosition === 'suffix') {
                return `${normalizedValue} ${symbol}`;
              }
              // Unknown symbolPosition - default to suffix
              return `${normalizedValue} ${symbol}`;
            }
          } catch {
            // Invalid currency code - return value without currency symbol
            return formattedValue;
          }
        }
      }
      return formattedValue;
    }

    try {
      const symbol = getCurrencySymbol(this.currency);
      if (this.currency.symbolPosition === 'prefix') {
        return `${symbol} ${normalizedValue}`;
      } else if (this.currency.symbolPosition === 'suffix') {
        return `${normalizedValue} ${symbol}`;
      }
      // Unknown symbolPosition - default to suffix
      return `${normalizedValue} ${symbol}`;
    } catch {
      // Invalid currency code - return value without currency symbol
      return formattedValue;
    }
  }
}

export default CurrencyFormatter;
