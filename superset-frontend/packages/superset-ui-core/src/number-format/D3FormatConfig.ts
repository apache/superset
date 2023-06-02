// DODO was here
import { FormatLocaleDefinition } from 'd3-format';

export const DEFAULT_D3_FORMAT: FormatLocaleDefinition = {
  decimal: '.',
  thousands: ',',
  grouping: [3],
  currency: ['$', ''],
};

interface ExtendedFormatLocaleDefinition extends FormatLocaleDefinition {
  id: string;
  code: string;
}

type SUPPORTED_LOCALES =
  | 'DEFAULT_2f'
  | 'RUB_2f'
  | 'EUR_2f'
  | 'PLN_2f'
  | 'KGS_2f'
  | 'UZS_2f';

export const SUPPORTED_LOCALES_ARRAY = [
  'DEFAULT_2f',
  'RUB_2f',
  'EUR_2f',
  'PLN_2f',
  'KGS_2f',
  'UZS_2f',
];

export const D3_LOCALES: Record<
  SUPPORTED_LOCALES,
  ExtendedFormatLocaleDefinition
> = {
  DEFAULT_2f: {
    ...DEFAULT_D3_FORMAT,
    id: '$,.2f',
    code: 'USD',
  },
  RUB_2f: {
    id: '₽,.2f',
    decimal: ',',
    thousands: '\u00a0',
    grouping: [3],
    currency: ['', '\u00a0руб.'],
    code: 'RUB',
  },
  EUR_2f: {
    id: '€,.2f',
    decimal: '.',
    thousands: ',',
    grouping: [3],
    currency: ['€', ''],
    code: 'EUR',
  },
  PLN_2f: {
    id: 'zł,.2f',
    decimal: ',',
    thousands: '.',
    grouping: [3],
    currency: ['', 'zł'],
    code: 'PLN',
  },
  KGS_2f: {
    id: 'сом,.2f',
    decimal: ',',
    thousands: '\u00a0',
    grouping: [3],
    currency: ['', '\u00a0сом.'],
    code: 'KGS',
  },
  UZS_2f: {
    id: 'сум,.2f',
    decimal: ',',
    thousands: '\u00a0',
    grouping: [3],
    currency: ['', '\u00a0сум.'],
    code: 'UZS',
  },
};
