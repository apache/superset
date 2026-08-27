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
import { FormatLocaleDefinition } from 'd3-format';
import { DEFAULT_D3_FORMAT } from '@superset-ui/core';

export type NumberFormatLocaleCode =
  | 'en_US'
  | 'en_GB'
  | 'de_DE'
  | 'es_ES'
  | 'fr_FR'
  | 'it_IT'
  | 'nl_NL'
  | 'pl_PL';

const US_SEPARATORS = { decimal: '.', thousands: ',', grouping: [3] };
const CONTINENTAL_SEPARATORS = { decimal: ',', thousands: '.', grouping: [3] };

export const NUMBER_FORMAT_LOCALES: Record<
  NumberFormatLocaleCode,
  FormatLocaleDefinition
> = {
  en_US: { ...DEFAULT_D3_FORMAT, ...US_SEPARATORS },
  en_GB: { ...DEFAULT_D3_FORMAT, ...US_SEPARATORS },
  de_DE: { ...DEFAULT_D3_FORMAT, ...CONTINENTAL_SEPARATORS },
  es_ES: { ...DEFAULT_D3_FORMAT, ...CONTINENTAL_SEPARATORS },
  it_IT: { ...DEFAULT_D3_FORMAT, ...CONTINENTAL_SEPARATORS },
  nl_NL: { ...DEFAULT_D3_FORMAT, ...CONTINENTAL_SEPARATORS },
  fr_FR: { ...DEFAULT_D3_FORMAT, ...CONTINENTAL_SEPARATORS },
  pl_PL: { ...DEFAULT_D3_FORMAT, ...CONTINENTAL_SEPARATORS },
};

export function canonicalizeNumberFormatLocale(
  value?: string | null,
): NumberFormatLocaleCode | undefined {
  if (!value) {
    return undefined;
  }
  const raw = value.trim().replace(/-/g, '_');
  if (raw in NUMBER_FORMAT_LOCALES) {
    return raw as NumberFormatLocaleCode;
  }
  const parts = raw.split('_');
  if (parts.length >= 2 && parts[1].length === 2) {
    const canonical = `${parts[0].toLowerCase()}_${parts[1].toUpperCase()}`;
    if (canonical in NUMBER_FORMAT_LOCALES) {
      return canonical as NumberFormatLocaleCode;
    }
  }
  return undefined;
}

/**
 * Resolve URL `locale` or embed `lang` (en_GB, fr_FR, …).
 */
export function resolveNumberFormatLocaleCode(
  localeParam?: string | null,
  langParam?: string | null,
): NumberFormatLocaleCode | undefined {
  return (
    canonicalizeNumberFormatLocale(localeParam) ||
    canonicalizeNumberFormatLocale(langParam)
  );
}

/**
 * Resolve a URL `locale` value to a d3-format locale definition.
 * Missing / unsupported values fall back to the server d3_format config.
 */
export function resolveNumberFormatLocale(
  localeParam?: string | null,
  d3Format?: Partial<FormatLocaleDefinition>,
): FormatLocaleDefinition {
  const localeCode = resolveNumberFormatLocaleCode(localeParam);
  if (localeCode) {
    return NUMBER_FORMAT_LOCALES[localeCode];
  }
  return { ...DEFAULT_D3_FORMAT, ...d3Format };
}
