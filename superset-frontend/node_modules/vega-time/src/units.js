import {array, error, extend, hasOwnProperty} from 'vega-util';

export const YEAR = 'year';
export const QUARTER = 'quarter';
export const MONTH = 'month';
export const WEEK = 'week';
export const DATE = 'date';
export const DAY = 'day';
export const DAYOFYEAR = 'dayofyear';
export const HOURS = 'hours';
export const MINUTES = 'minutes';
export const SECONDS = 'seconds';
export const MILLISECONDS = 'milliseconds';

export const TIME_UNITS = [
  YEAR,
  QUARTER,
  MONTH,
  WEEK,
  DATE,
  DAY,
  DAYOFYEAR,
  HOURS,
  MINUTES,
  SECONDS,
  MILLISECONDS
];

const UNITS = TIME_UNITS.reduce((o, u, i) => (o[u] = 1 + i, o), {});

export function timeUnits(units) {
  const u = array(units).slice(),
        m = {};

  // check validity
  if (!u.length) error('Missing time unit.');

  u.forEach(unit => {
    if (hasOwnProperty(UNITS, unit)) {
      m[unit] = 1;
    } else {
      error(`Invalid time unit: ${unit}.`);
    }
  });

  const numTypes = (
    (m[WEEK] || m[DAY] ? 1 : 0) +
    (m[QUARTER] || m[MONTH] || m[DATE] ? 1 : 0) +
    (m[DAYOFYEAR] ? 1 : 0)
  );

  if (numTypes > 1) {
    error(`Incompatible time units: ${units}`);
  }

  // ensure proper sort order
  u.sort((a, b) => UNITS[a] - UNITS[b]);

  return u;
}

const defaultSpecifiers = {
  [YEAR]: '%Y ',
  [QUARTER]: 'Q%q ',
  [MONTH]: '%b ',
  [DATE]: '%d ',
  [WEEK]: 'W%U ',
  [DAY]: '%a ',
  [DAYOFYEAR]: '%j ',
  [HOURS]: '%H:00',
  [MINUTES]: '00:%M',
  [SECONDS]: ':%S',
  [MILLISECONDS]: '.%L',
  [`${YEAR}-${MONTH}`]: '%Y-%m ',
  [`${YEAR}-${MONTH}-${DATE}`]: '%Y-%m-%d ',
  [`${HOURS}-${MINUTES}`]: '%H:%M'
};

export function timeUnitSpecifier(units, specifiers) {
  const s = extend({}, defaultSpecifiers, specifiers),
        u = timeUnits(units),
        n = u.length;

  let fmt = '', start = 0, end, key;

  for (start=0; start<n; ) {
    for (end=u.length; end > start; --end) {
      key = u.slice(start, end).join('-');
      if (s[key] != null) {
        fmt += s[key];
        start = end;
        break;
      }
    }
  }

  return fmt.trim();
}
