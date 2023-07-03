// DODO was here
import { FormatLocaleDefinition } from 'd3-format';

interface ExtendedFormatLocaleDefinition extends FormatLocaleDefinition {
  id: string;
  code: string;
}

type SUPPORTED_CURRENCIES_LOCALES =
  | 'DEFAULT_2f'
  | 'RUB_2f'
  | 'RUS_2f'
  | 'RUS_2f_ROUNDED'
  | 'EUR_2f'
  | 'PLN_2f'
  | 'KGS_2f'
  | 'UZS_2f'
  | 'NGN_2f'
  | 'RON_2f'
  | 'TJS_2f'
  | 'VND_2f'
  | 'RSD_2f'
  | 'AMD_2f'
  | 'GEL_2f'
  | 'IDR_2f'
  | 'AZN_2f'
  | 'BGN_2f'
  | 'AED_2f';

export const SUPPORTED_CURRENCIES_LOCALES_ARRAY = [
  'DEFAULT_2f',
  'RUB_2f',
  'RUS_2f',
  'RUS_2f_ROUNDED',
  'EUR_2f',
  'PLN_2f',
  'KGS_2f',
  'UZS_2f',
  'NGN_2f',
  'RON_2f',
  'TJS_2f',
  'VND_2f',
  'RSD_2f',
  'AMD_2f',
  'GEL_2f',
  'IDR_2f',
  'AZN_2f',
  'BGN_2f',
  'AED_2f',
];

const UNICODE = {
  SPACE: '\u00a0',
  COMMA: '\u002c',
  POINT: '\u002e',
  SYM: {
    USD: '\u0024',
    RUB: '\u0440\u0443\u0431',
    EUR: '\u20ac',
    PLN: '\u007a\u0142',
    KGS: '\u0441\u043e\u043c',
    UZS: '\u0441\u0443\u043c',
    NGN: '\u20a6',
    RON: '\u006c\u0065\u0069',
    TJS: '\u0063',
    VND: '\u20ab',
    RSD: '\u0064\u0069\u006e',
    AMD: '\u058f',
    GEL: '\u20be',
    IDR: '\u0052\u0070',
    AZN: '\u20bc',
    BGN: '\u043b\u0432\u002e',
    AED: '\u0064\u0068',
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
  DEFAULT_2f: {
    ...DEFAULT_D3_FORMAT,
    id: `${UNICODE.SYM.USD},.2f`,
    code: 'USD',
  },
  RUB_2f: {
    id: `${UNICODE.SYM.RUB},.2f`,
    decimal: UNICODE.COMMA,
    thousands: UNICODE.SPACE,
    grouping: [3],
    currency: ['', `${UNICODE.SPACE}${UNICODE.SYM.RUB}${UNICODE.POINT}`],
    code: 'RUB',
  },
  // special format for formatting values with a russian locale, but without a russian currency
  RUS_2f: {
    id: `RUSSIAN_SPACES,.2f`,
    decimal: UNICODE.COMMA,
    thousands: UNICODE.SPACE,
    grouping: [3],
    currency: ['', ''],
    code: 'RUS',
  },
  RUS_2f_ROUNDED: {
    id: `RUSSIAN_SPACES_ROUNDED,.2f`,
    decimal: UNICODE.COMMA,
    thousands: UNICODE.SPACE,
    grouping: [3],
    currency: ['', ''],
    code: 'RUS_ROUNDED',
  },
  EUR_2f: {
    id: `${UNICODE.SYM.EUR},.2f`,
    decimal: UNICODE.POINT,
    thousands: UNICODE.COMMA,
    grouping: [3],
    currency: [UNICODE.SYM.EUR, ''],
    code: 'EUR',
  },
  PLN_2f: {
    id: `${UNICODE.SYM.PLN},.2f`,
    decimal: UNICODE.COMMA,
    thousands: UNICODE.POINT,
    grouping: [3],
    currency: ['', UNICODE.SYM.PLN],
    code: 'PLN',
  },
  KGS_2f: {
    id: `${UNICODE.SYM.KGS},.2f`,
    decimal: UNICODE.COMMA,
    thousands: UNICODE.SPACE,
    grouping: [3],
    currency: ['', `${UNICODE.SPACE}${UNICODE.SYM.KGS}${UNICODE.POINT}`],
    code: 'KGS',
  },
  UZS_2f: {
    id: `${UNICODE.SYM.UZS},.2f`,
    decimal: UNICODE.COMMA,
    thousands: UNICODE.SPACE,
    grouping: [3],
    currency: ['', `${UNICODE.SPACE}${UNICODE.SYM.UZS}${UNICODE.POINT}`],
    code: 'UZS',
  },
  NGN_2f: {
    id: `${UNICODE.SYM.NGN},.2f`,
    decimal: UNICODE.COMMA,
    thousands: UNICODE.SPACE,
    grouping: [3],
    currency: ['', `${UNICODE.SPACE}${UNICODE.SYM.NGN}`],
    code: 'NGN',
  },
  RON_2f: {
    id: `${UNICODE.SYM.RON},.2f`,
    decimal: UNICODE.COMMA,
    thousands: UNICODE.SPACE,
    grouping: [3],
    currency: ['', `${UNICODE.SPACE}${UNICODE.SYM.RON}`],
    code: 'RON',
  },
  TJS_2f: {
    id: `${UNICODE.SYM.TJS},.2f`,
    decimal: UNICODE.COMMA,
    thousands: UNICODE.SPACE,
    grouping: [3],
    currency: ['', `${UNICODE.SPACE}${UNICODE.SYM.TJS}${UNICODE.POINT}`],
    code: 'TJS',
  },
  VND_2f: {
    id: `${UNICODE.SYM.VND},.2f`,
    decimal: UNICODE.COMMA,
    thousands: UNICODE.SPACE,
    grouping: [3],
    currency: ['', `${UNICODE.SPACE}${UNICODE.SYM.VND}`],
    code: 'VND',
  },
  RSD_2f: {
    id: `${UNICODE.SYM.RSD},.2f`,
    decimal: UNICODE.COMMA,
    thousands: UNICODE.POINT,
    grouping: [3],
    currency: ['', `${UNICODE.SPACE}${UNICODE.SYM.RSD}`],
    code: 'RSD',
  },
  AMD_2f: {
    id: `${UNICODE.SYM.AMD},.2f`,
    decimal: UNICODE.COMMA,
    thousands: UNICODE.POINT,
    grouping: [3],
    currency: [UNICODE.SYM.AMD, ''],
    code: 'AMD',
  },
  GEL_2f: {
    id: `${UNICODE.SYM.GEL},.2f`,
    decimal: UNICODE.POINT,
    thousands: UNICODE.SPACE,
    grouping: [3],
    currency: ['', `${UNICODE.SPACE}${UNICODE.SYM.GEL}`],
    code: 'GEL',
  },
  IDR_2f: {
    id: `${UNICODE.SYM.IDR},.2f`,
    decimal: UNICODE.COMMA,
    thousands: UNICODE.POINT,
    grouping: [3],
    currency: [`${UNICODE.SYM.IDR}${UNICODE.SPACE}`, ''],
    code: 'IDR',
  },
  AZN_2f: {
    id: `${UNICODE.SYM.AZN},.2f`,
    decimal: UNICODE.POINT,
    thousands: UNICODE.SPACE,
    grouping: [3],
    currency: ['', `${UNICODE.SPACE}${UNICODE.SYM.AZN}`],
    code: 'AZN',
  },
  BGN_2f: {
    id: `${UNICODE.SYM.BGN},.2f`,
    decimal: UNICODE.COMMA,
    thousands: UNICODE.SPACE,
    grouping: [3],
    currency: ['', `${UNICODE.SPACE}${UNICODE.SYM.BGN}`],
    code: 'BGN',
  },
  AED_2f: {
    id: `${UNICODE.SYM.AED},.2f`,
    decimal: UNICODE.COMMA,
    thousands: UNICODE.SPACE,
    grouping: [3],
    currency: ['', `${UNICODE.SPACE}${UNICODE.SYM.AED}`],
    code: 'AED',
  },
};
