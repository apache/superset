// DODO was here
import {
  t,
  smartDateFormatter,
  NumberFormats,
  getNumberFormatterRegistry,
  PREVIEW_VALUE,
  SUPPORTED_CURRENCIES_LOCALES_ARRAY,
  D3_CURRENCIES_LOCALES,
} from '@superset-ui/core';

// D3 specific formatting config
export const D3_FORMAT_DOCS = t(
  'D3 format syntax: https://github.com/d3/d3-format',
);

export const D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT = t(
  'Only applies when "Label Type" is set to show values.',
);
export const D3_NUMBER_FORMAT_DESCRIPTION_PERCENTAGE_TEXT = t(
  'Only applies when "Label Type" is not set to a percentage.',
);

const d3Currencies = (): [string, string][] =>
  SUPPORTED_CURRENCIES_LOCALES_ARRAY.map(localeName => {
    const { id, code } = D3_CURRENCIES_LOCALES[localeName];
    let displayName = '';

    // special format for formatting values with a russian locale, but without a russian currency
    if (localeName === 'RUSSIAN') displayName = t('With space');
    else if (localeName === 'RUSSIAN_ROUNDED')
      displayName = t('With space rounded');
    else if (localeName === 'DEFAULT_ROUNDED') displayName = t('Rounded');
    else if (localeName === 'RUSSIAN_ROUNDED_1')
      displayName = t('With space rounded 1');
    else if (localeName === 'RUSSIAN_ROUNDED_2')
      displayName = t('With space rounded 2');
    else if (localeName === 'RUSSIAN_ROUNDED_3')
      displayName = t('With space rounded 3');
    else displayName = code;

    const preview = getNumberFormatterRegistry().format(id, PREVIEW_VALUE);
    return [id, `${displayName} (${PREVIEW_VALUE} => ${preview})`];
  });

// input choices & options
export const D3_FORMAT_OPTIONS: [string, string][] = [
  [NumberFormats.SMART_NUMBER, t('Adaptive formatting')],
  ['~g', t('Original value')],
  [',d', ',d (12345.432 => 12,345)'],
  ['.1s', '.1s (12345.432 => 10k)'],
  ['.3s', '.3s (12345.432 => 12.3k)'],
  [',.0%', ',.0% (12345.432 => 1,234,544%)'],
  [',.1%', ',.1% (12345.432 => 1,234,543.2%)'],
  ['.2%', '.2% (12345.432 => 1234543.20%)'],
  ['.3%', '.3% (12345.432 => 1234543.200%)'],
  ['.4r', '.4r (12345.432 => 12350)'],
  [',.1f', ',.1f (12345.432 => 12,345.4)'],
  [',.2f', ',.2f (12345.432 => 12,345.43)'],
  [',.3f', ',.3f (12345.432 => 12,345.432)'],
  ['+,', '+, (12345.432 => +12,345.432)'],
  ...d3Currencies(),
  ['DURATION', t('Duration in ms (66000 => 1m 6s)')],
  ['DURATION_SUB', t('Duration in ms (1.40008 => 1ms 400µs 80ns)')],
];

export const D3_TIME_FORMAT_DOCS = t(
  'D3 time format syntax: https://github.com/d3/d3-time-format',
);

export const D3_TIME_FORMAT_OPTIONS: [string, string][] = [
  [smartDateFormatter.id, t('Adaptive formatting')],
  ['%d/%m/%Y', '%d/%m/%Y | 14/01/2019'],
  ['%m/%d/%Y', '%m/%d/%Y | 01/14/2019'],
  ['%Y-%m-%d', '%Y-%m-%d | 2019-01-14'],
  ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M:%S | 2019-01-14 01:32:10'],
  ['%d-%m-%Y %H:%M:%S', '%d-%m-%Y %H:%M:%S | 14-01-2019 01:32:10'],
  ['%H:%M:%S', '%H:%M:%S | 01:32:10'],
];

export const DEFAULT_NUMBER_FORMAT = D3_FORMAT_OPTIONS[0][0];
export const DEFAULT_TIME_FORMAT = D3_TIME_FORMAT_OPTIONS[0][0];
