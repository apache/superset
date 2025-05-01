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

interface CurrencyFormatterConfig {
  d3Format?: string;
  currency: Currency;
  locale?: string;
}

interface CurrencyFormatter {
  (value: number | null | undefined): string;
}

export const getCurrencySymbol = (currency: Partial<Currency>) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.symbol,
  })
    .formatToParts(1)
    .find(x => x.type === 'currency')?.value;

class CurrencyFormatter extends ExtensibleFunction {
  d3Format: string;

  locale: string;

  currency: Currency;

  constructor(config: CurrencyFormatterConfig) {
    super((value: number) => this.format(value));
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

  format(value: number) {
    const formattedValue = getNumberFormatter(this.getNormalizedD3Format())(
      value,
    );
    if (!this.hasValidCurrency()) {
      return formattedValue as string;
    }

    if (this.currency.symbolPosition === 'prefix') {
      return `${getCurrencySymbol(this.currency)} ${formattedValue}`;
    }
    return `${formattedValue} ${getCurrencySymbol(this.currency)}`;
  }
}

export default CurrencyFormatter;
