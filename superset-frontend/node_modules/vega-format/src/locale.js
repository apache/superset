import {
  numberFormatDefaultLocale,
  numberFormatLocale,
  resetNumberFormatDefaultLocale
} from './number';

import {
  resetTimeFormatDefaultLocale,
  timeFormatDefaultLocale,
  timeFormatLocale
} from './time';

import {error, extend} from 'vega-util';

const createLocale = (number, time) => extend({}, number, time);

export function locale(numberSpec, timeSpec) {
  const number = numberSpec
    ? numberFormatLocale(numberSpec)
    : numberFormatDefaultLocale();

  const time = timeSpec
    ? timeFormatLocale(timeSpec)
    : timeFormatDefaultLocale();

  return createLocale(number, time);
}

export function defaultLocale(numberSpec, timeSpec) {
  const args = arguments.length;
  if (args && args !== 2) {
    error('defaultLocale expects either zero or two arguments.');
  }

  return args
    ? createLocale(
        numberFormatDefaultLocale(numberSpec),
        timeFormatDefaultLocale(timeSpec)
      )
    : createLocale(
        numberFormatDefaultLocale(),
        timeFormatDefaultLocale()
      );
}

export function resetDefaultLocale() {
  resetNumberFormatDefaultLocale();
  resetTimeFormatDefaultLocale();
  return defaultLocale();
}
