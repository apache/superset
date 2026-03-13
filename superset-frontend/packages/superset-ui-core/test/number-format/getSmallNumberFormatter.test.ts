/*
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
  CurrencyFormatter,
  getNumberFormatter,
  getSmallNumberFormatter,
  NumberFormatter,
} from '@superset-ui/core';

const defaultFormatter = getNumberFormatter('.8%');

describe('getSmallNumberFormatter', () => {
  it('returns defaultFormatter when d3SmallNumberFormat is undefined', () => {
    expect(getSmallNumberFormatter(defaultFormatter, undefined)).toBe(
      defaultFormatter,
    );
  });

  it('returns defaultFormatter when d3SmallNumberFormat is null (JSON round-trip)', () => {
    expect(getSmallNumberFormatter(defaultFormatter, null)).toBe(
      defaultFormatter,
    );
  });

  it('returns defaultFormatter when d3SmallNumberFormat is empty string (cleared Select)', () => {
    expect(getSmallNumberFormatter(defaultFormatter, '')).toBe(
      defaultFormatter,
    );
  });

  it('returns defaultFormatter when d3SmallNumberFormat is whitespace', () => {
    expect(getSmallNumberFormatter(defaultFormatter, '  ')).toBe(
      defaultFormatter,
    );
  });

  it('returns a NumberFormatter when d3SmallNumberFormat is a valid format', () => {
    const result = getSmallNumberFormatter(defaultFormatter, ',.4f');
    expect(result).toBeInstanceOf(NumberFormatter);
    expect(result).not.toBe(defaultFormatter);
    expect(result!(0.12345)).toBe('0.1235');
  });

  it('returns a CurrencyFormatter when currencyFormat is provided', () => {
    const result = getSmallNumberFormatter(defaultFormatter, ',.4f', {
      symbol: 'USD',
      symbolPosition: 'prefix',
    });
    expect(result).toBeInstanceOf(CurrencyFormatter);
    expect(result!(0.12345)).toContain('0.1235');
    expect(result!(0.12345)).toContain('$');
  });

  it('preserves percentage formatter output for small numbers when d3SmallNumberFormat is null', () => {
    const pctFormatter = getNumberFormatter('.8%');
    const result = getSmallNumberFormatter(pctFormatter, null);
    expect(result!(-0.00001229)).toBe('-0.00122900%');
  });

  it('returns undefined when defaultFormatter is undefined and d3SmallNumberFormat is nullish', () => {
    expect(getSmallNumberFormatter(undefined, null)).toBeUndefined();
    expect(getSmallNumberFormatter(undefined, undefined)).toBeUndefined();
    expect(getSmallNumberFormatter(undefined, '')).toBeUndefined();
  });
});
