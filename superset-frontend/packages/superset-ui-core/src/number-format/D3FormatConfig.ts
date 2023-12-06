// DODO was here

import { FormatLocaleDefinition } from 'd3-format';

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

export const DEFAULT_D3_FORMAT: FormatLocaleDefinition = {
  decimal: UNICODE.POINT,
  thousands: UNICODE.COMMA,
  grouping: [3],
  currency: [UNICODE.SYM.USD, ''],
};

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
