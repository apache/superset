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

/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */

interface CurrencyFormatterConfig {
  d3Format?: string;
  currency: Currency;
  locale?: string;
}

interface CurrencyFormatter {
  (
    value: number | null | undefined,
    rowData?: Record<string, any>,
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

/**
 * Normalize currency codes and symbols to standardized ISO 4217 codes.
 * Handles lowercase codes, common symbols, and whitespace.
 *
 * @param value - Currency code or symbol to normalize
 * @returns Normalized ISO 4217 currency code, or null if invalid
 */
export function normalizeCurrency(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  const str = value.toString().trim();
  if (!str) return null;

  const upper = str.toUpperCase();

  // Already ISO code (3 uppercase letters)
  if (/^[A-Z]{3}$/.test(upper)) return upper;

  // Common symbol mappings (use original case-sensitive value)
  const symbolMap: Record<string, string> = {
    $: 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'JPY',
    '₹': 'INR',
  };

  // Full currency name mappings (use uppercase)
  const nameMap: Record<string, string> = {
    DOLLAR: 'USD',
    DOLLARS: 'USD',
    EURO: 'EUR',
    EUROS: 'EUR',
    POUND: 'GBP',
    POUNDS: 'GBP',
    YEN: 'JPY',
    RUPEE: 'INR',
    RUPEES: 'INR',
  };

  return symbolMap[str] || nameMap[upper] || null;
}

/**
 * Determine if an array of currency values contains mixed currencies.
 * Normalizes currencies before comparison to handle different formats.
 *
 * @param currencies - Array of currency codes/symbols to check
 * @returns True if multiple distinct currencies are present, false otherwise
 */
export function hasMixedCurrencies(
  currencies: (string | null | undefined)[],
): boolean {
  // Filter out null/undefined and normalize
  const normalized = currencies
    .map(c => normalizeCurrency(c))
    .filter((c): c is string => c !== null);

  if (normalized.length === 0) return false;

  // Check if all normalized currencies are the same
  const first = normalized[0];
  return !normalized.every(c => c === first);
}

class CurrencyFormatter extends ExtensibleFunction {
  d3Format: string;

  locale: string;

  currency: Currency;

  constructor(config: CurrencyFormatterConfig) {
    super(
      (value: number, rowData?: Record<string, any>, currencyColumn?: string) =>
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
    return this.d3Format.replace(/\$|%/g, '');
  }

  format(
    value: number,
    rowData?: Record<string, any>,
    currencyColumn?: string,
  ): string {
    const formattedValue = getNumberFormatter(this.getNormalizedD3Format())(
      value,
    );

    // Check if AUTO mode is enabled
    const isAutoMode = this.currency?.symbol === 'AUTO';

    if (!this.hasValidCurrency() && !isAutoMode) {
      return formattedValue as string;
    }

    // AUTO mode: Use row context if available
    if (isAutoMode) {
      if (rowData && currencyColumn && rowData[currencyColumn]) {
        const rawCurrency = rowData[currencyColumn];
        const normalizedCurrency = normalizeCurrency(rawCurrency);

        if (normalizedCurrency) {
          try {
            const symbol = getCurrencySymbol({ symbol: normalizedCurrency });
            if (symbol) {
              if (this.currency.symbolPosition === 'prefix') {
                return `${symbol} ${formattedValue}`;
              }
              return `${formattedValue} ${symbol}`;
            }
          } catch (error) {
            // If currency code is invalid, fall through to neutral format
          }
        }
      }

      // No row context or invalid currency - return neutral format
      return formattedValue as string;
    }

    // Static mode: Use configured currency
    if (this.currency.symbolPosition === 'prefix') {
      return `${getCurrencySymbol(this.currency)} ${formattedValue}`;
    }
    return `${formattedValue} ${getCurrencySymbol(this.currency)}`;
  }
}

export default CurrencyFormatter;
