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

const DEFAULT_CURRENCY_LOCALE = 'en-US';

let currencyLocale: string = DEFAULT_CURRENCY_LOCALE;

/**
 * Set the locale used to resolve the default currency symbol position.
 *
 * Called once at application bootstrap with the deployment locale so that
 * currency formatting follows the conventions of that locale (e.g. EUR is a
 * suffix in `fr-FR`/`de-DE` but a prefix in `en-US`).
 *
 * Superset's bootstrap locale can be underscore-formatted (e.g. `zh_TW`,
 * `pt_BR`), but `Intl.NumberFormat` expects BCP-47 tags with hyphens. The
 * value is canonicalized before storing so symbol resolution does not throw
 * and silently fall back. Empty or invalid tags leave the locale unchanged.
 */
export function setCurrencyLocale(locale?: string): void {
  if (!locale) {
    return;
  }
  try {
    // getCanonicalLocales throws on a malformed tag and otherwise returns a
    // non-empty list, so the first entry is always a valid canonical tag here.
    [currencyLocale] = Intl.getCanonicalLocales(locale.replace(/_/g, '-'));
  } catch {
    // Invalid locale tag — keep the previously configured locale.
  }
}

/** Get the locale used to resolve the default currency symbol position. */
export function getCurrencyLocale(): string {
  return currencyLocale;
}
