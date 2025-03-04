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

// DODO added start 44211769
interface ExtendedFormatLocaleDefinition extends FormatLocaleDefinition {
  id: string;
  code: string;
}
type SUPPORTED_CURRENCIES_LOCALES =
  | 'RUSSIAN'
  | 'RUSSIAN_ROUNDED'
  | 'DEFAULT_ROUNDED'
  | 'RUSSIAN_ROUNDED_1'
  | 'RUSSIAN_ROUNDED_2'
  | 'RUSSIAN_ROUNDED_3';
export const SUPPORTED_CURRENCIES_LOCALES_ARRAY = [
  'RUSSIAN',
  'RUSSIAN_ROUNDED',
  'DEFAULT_ROUNDED',
  'RUSSIAN_ROUNDED_1',
  'RUSSIAN_ROUNDED_2',
  'RUSSIAN_ROUNDED_3',
];
const UNICODE = {
  SPACE: '\u00a0',
  COMMA: '\u002c',
  POINT: '\u002e',
  SYM: {
    USD: '\u0024',
    RUB: '\u0440\u0443\u0431',
    EUR: '\u20ac',
  },
};
// DODO added stop 44211769

export const DEFAULT_D3_FORMAT: FormatLocaleDefinition = {
  // decimal: '.',
  // thousands: ',',
  decimal: UNICODE.POINT, // DODO changed 44211769
  thousands: UNICODE.COMMA, // DODO changed 44211769
  grouping: [3],
  // currency: ['$', ''],
  currency: [UNICODE.SYM.USD, ''], // DODO changed 44211769
};

// DODO added 44211769
export const D3_CURRENCIES_LOCALES: Record<
  SUPPORTED_CURRENCIES_LOCALES,
  ExtendedFormatLocaleDefinition
> = {
  // special format for formatting values with a russian locale, but without a russian currency
  RUSSIAN: {
    id: `RUSSIAN_SPACES,.2f`,
    decimal: UNICODE.COMMA,
    thousands: UNICODE.SPACE,
    grouping: [3],
    currency: ['', ''],
    code: 'RUS',
  },
  RUSSIAN_ROUNDED: {
    id: `RUSSIAN_SPACES_ROUNDED,.2f`,
    decimal: UNICODE.COMMA,
    thousands: UNICODE.SPACE,
    grouping: [3],
    currency: ['', ''],
    code: 'RUS_ROUNDED',
  },
  DEFAULT_ROUNDED: {
    id: `DEFAULT_ROUNDED,.2f`,
    decimal: UNICODE.POINT,
    thousands: UNICODE.COMMA,
    grouping: [3],
    currency: ['', ''],
    code: 'DEF_ROUNDED',
  },
  RUSSIAN_ROUNDED_1: {
    id: `RUSSIAN_SPACES_ROUNDED_1,.2f`,
    decimal: UNICODE.COMMA,
    thousands: UNICODE.SPACE,
    grouping: [3],
    currency: ['', ''],
    code: 'RUS_ROUNDED_1',
  },
  RUSSIAN_ROUNDED_2: {
    id: `RUSSIAN_SPACES_ROUNDED_2,.2f`,
    decimal: UNICODE.COMMA,
    thousands: UNICODE.SPACE,
    grouping: [3],
    currency: ['', ''],
    code: 'RUS_ROUNDED_2',
  },
  RUSSIAN_ROUNDED_3: {
    id: `RUSSIAN_SPACES_ROUNDED_3,.2f`,
    decimal: UNICODE.COMMA,
    thousands: UNICODE.SPACE,
    grouping: [3],
    currency: ['', ''],
    code: 'RUS_ROUNDED_3',
  },
};
