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

import { CurrencyFormatter } from '../currency-format';
import { Currency } from '../query';
import NumberFormatter from './NumberFormatter';
import { getNumberFormatter } from './NumberFormatterRegistrySingleton';

/**
 * Returns the appropriate formatter for small numbers (|value| < 1).
 *
 * When `d3SmallNumberFormat` is nullish or blank the caller's default
 * formatter is returned unchanged, which preserves percentage formats
 * that would otherwise be lost.
 *
 * Handles the cases where `d3SmallNumberFormat` is `null` (from JSON
 * serialization of `undefined`) or `""` (from a cleared Select control).
 *
 * The generic parameter `F` allows callers to pass any formatter type
 * (e.g. TimeFormatter, CustomFormatter) without a circular dependency
 * on @superset-ui/chart-controls.
 */
export default function getSmallNumberFormatter<F>(
  defaultFormatter: F,
  d3SmallNumberFormat: string | null | undefined,
  currencyFormat?: Currency,
): F | NumberFormatter | CurrencyFormatter {
  if (d3SmallNumberFormat == null || d3SmallNumberFormat.trim() === '') {
    return defaultFormatter;
  }
  if (currencyFormat) {
    return new CurrencyFormatter({
      d3Format: d3SmallNumberFormat,
      currency: currencyFormat,
    });
  }
  return getNumberFormatter(d3SmallNumberFormat);
}
