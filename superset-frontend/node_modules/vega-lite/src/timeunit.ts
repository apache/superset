import stringify from 'fast-json-stable-stringify';
import {isObject, isString} from 'vega-util';
import {DateTimeExpr, dateTimeExprToExpr} from './datetime';
import * as log from './log';
import {accessPathWithDatum, Flag, keys, replaceAll, varName} from './util';

export namespace TimeUnit {
  export const YEAR: 'year' = 'year';
  export const MONTH: 'month' = 'month';
  export const DAY: 'day' = 'day';
  export const DATE: 'date' = 'date';
  export const HOURS: 'hours' = 'hours';
  export const MINUTES: 'minutes' = 'minutes';
  export const SECONDS: 'seconds' = 'seconds';
  export const MILLISECONDS: 'milliseconds' = 'milliseconds';
  export const YEARMONTH: 'yearmonth' = 'yearmonth';
  export const YEARMONTHDATE: 'yearmonthdate' = 'yearmonthdate';
  export const YEARMONTHDATEHOURS: 'yearmonthdatehours' = 'yearmonthdatehours';
  export const YEARMONTHDATEHOURSMINUTES: 'yearmonthdatehoursminutes' = 'yearmonthdatehoursminutes';
  export const YEARMONTHDATEHOURSMINUTESSECONDS: 'yearmonthdatehoursminutesseconds' =
    'yearmonthdatehoursminutesseconds';

  // MONTHDATE and MONTHDATEHOURS always include 29 February since we use year 0th (which is a leap year);
  export const MONTHDATE: 'monthdate' = 'monthdate';
  export const MONTHDATEHOURS: 'monthdatehours' = 'monthdatehours';
  export const HOURSMINUTES: 'hoursminutes' = 'hoursminutes';
  export const HOURSMINUTESSECONDS: 'hoursminutesseconds' = 'hoursminutesseconds';
  export const MINUTESSECONDS: 'minutesseconds' = 'minutesseconds';
  export const SECONDSMILLISECONDS: 'secondsmilliseconds' = 'secondsmilliseconds';
  export const QUARTER: 'quarter' = 'quarter';
  export const YEARQUARTER: 'yearquarter' = 'yearquarter';
  export const QUARTERMONTH: 'quartermonth' = 'quartermonth';
  export const YEARQUARTERMONTH: 'yearquartermonth' = 'yearquartermonth';
  export const UTCYEAR: 'utcyear' = 'utcyear';
  export const UTCMONTH: 'utcmonth' = 'utcmonth';
  export const UTCDAY: 'utcday' = 'utcday';
  export const UTCDATE: 'utcdate' = 'utcdate';
  export const UTCHOURS: 'utchours' = 'utchours';
  export const UTCMINUTES: 'utcminutes' = 'utcminutes';
  export const UTCSECONDS: 'utcseconds' = 'utcseconds';
  export const UTCMILLISECONDS: 'utcmilliseconds' = 'utcmilliseconds';
  export const UTCYEARMONTH: 'utcyearmonth' = 'utcyearmonth';
  export const UTCYEARMONTHDATE: 'utcyearmonthdate' = 'utcyearmonthdate';
  export const UTCYEARMONTHDATEHOURS: 'utcyearmonthdatehours' = 'utcyearmonthdatehours';
  export const UTCYEARMONTHDATEHOURSMINUTES: 'utcyearmonthdatehoursminutes' = 'utcyearmonthdatehoursminutes';
  export const UTCYEARMONTHDATEHOURSMINUTESSECONDS: 'utcyearmonthdatehoursminutesseconds' =
    'utcyearmonthdatehoursminutesseconds';

  // UTCMONTHDATE and UTCMONTHDATEHOURS always include 29 February since we use year 0th (which is a leap year);
  export const UTCMONTHDATE: 'utcmonthdate' = 'utcmonthdate';
  export const UTCMONTHDATEHOURS: 'utcmonthdatehours' = 'utcmonthdatehours';
  export const UTCHOURSMINUTES: 'utchoursminutes' = 'utchoursminutes';
  export const UTCHOURSMINUTESSECONDS: 'utchoursminutesseconds' = 'utchoursminutesseconds';
  export const UTCMINUTESSECONDS: 'utcminutesseconds' = 'utcminutesseconds';
  export const UTCSECONDSMILLISECONDS: 'utcsecondsmilliseconds' = 'utcsecondsmilliseconds';
  export const UTCQUARTER: 'utcquarter' = 'utcquarter';
  export const UTCYEARQUARTER: 'utcyearquarter' = 'utcyearquarter';
  export const UTCQUARTERMONTH: 'utcquartermonth' = 'utcquartermonth';
  export const UTCYEARQUARTERMONTH: 'utcyearquartermonth' = 'utcyearquartermonth';
}

export type LocalSingleTimeUnit =
  | typeof TimeUnit.YEAR
  | typeof TimeUnit.QUARTER
  | typeof TimeUnit.MONTH
  | typeof TimeUnit.DAY
  | typeof TimeUnit.DATE
  | typeof TimeUnit.HOURS
  | typeof TimeUnit.MINUTES
  | typeof TimeUnit.SECONDS
  | typeof TimeUnit.MILLISECONDS;

/** Time Unit that only corresponds to only one part of Date objects. */
const LOCAL_SINGLE_TIMEUNIT_INDEX: Flag<LocalSingleTimeUnit> = {
  year: 1,
  quarter: 1,
  month: 1,
  day: 1,
  date: 1,
  hours: 1,
  minutes: 1,
  seconds: 1,
  milliseconds: 1
};

export const TIMEUNIT_PARTS = keys(LOCAL_SINGLE_TIMEUNIT_INDEX);

export function isLocalSingleTimeUnit(timeUnit: string): timeUnit is LocalSingleTimeUnit {
  return !!LOCAL_SINGLE_TIMEUNIT_INDEX[timeUnit];
}

export type UtcSingleTimeUnit =
  | typeof TimeUnit.UTCYEAR
  | typeof TimeUnit.UTCQUARTER
  | typeof TimeUnit.UTCMONTH
  | typeof TimeUnit.UTCDAY
  | typeof TimeUnit.UTCDATE
  | typeof TimeUnit.UTCHOURS
  | typeof TimeUnit.UTCMINUTES
  | typeof TimeUnit.UTCSECONDS
  | typeof TimeUnit.UTCMILLISECONDS;

const UTC_SINGLE_TIMEUNIT_INDEX: Flag<UtcSingleTimeUnit> = {
  utcyear: 1,
  utcquarter: 1,
  utcmonth: 1,
  utcday: 1,
  utcdate: 1,
  utchours: 1,
  utcminutes: 1,
  utcseconds: 1,
  utcmilliseconds: 1
};

export function isUtcSingleTimeUnit(timeUnit: string): timeUnit is UtcSingleTimeUnit {
  return !!UTC_SINGLE_TIMEUNIT_INDEX[timeUnit];
}

export type SingleTimeUnit = LocalSingleTimeUnit | UtcSingleTimeUnit;

export type LocalMultiTimeUnit =
  // Local Time
  | typeof TimeUnit.YEARQUARTER
  | typeof TimeUnit.YEARQUARTERMONTH
  | typeof TimeUnit.YEARMONTH
  | typeof TimeUnit.YEARMONTHDATE
  | typeof TimeUnit.YEARMONTHDATEHOURS
  | typeof TimeUnit.YEARMONTHDATEHOURSMINUTES
  | typeof TimeUnit.YEARMONTHDATEHOURSMINUTESSECONDS
  | typeof TimeUnit.QUARTERMONTH
  | typeof TimeUnit.MONTHDATE
  | typeof TimeUnit.MONTHDATEHOURS
  | typeof TimeUnit.HOURSMINUTES
  | typeof TimeUnit.HOURSMINUTESSECONDS
  | typeof TimeUnit.MINUTESSECONDS
  | typeof TimeUnit.SECONDSMILLISECONDS;

const LOCAL_MULTI_TIMEUNIT_INDEX: Flag<LocalMultiTimeUnit> = {
  yearquarter: 1,
  yearquartermonth: 1,

  yearmonth: 1,
  yearmonthdate: 1,
  yearmonthdatehours: 1,
  yearmonthdatehoursminutes: 1,
  yearmonthdatehoursminutesseconds: 1,

  quartermonth: 1,

  monthdate: 1,
  monthdatehours: 1,

  hoursminutes: 1,
  hoursminutesseconds: 1,

  minutesseconds: 1,

  secondsmilliseconds: 1
};

export type UtcMultiTimeUnit =
  | typeof TimeUnit.UTCYEARQUARTER
  | typeof TimeUnit.UTCYEARQUARTERMONTH
  | typeof TimeUnit.UTCYEARMONTH
  | typeof TimeUnit.UTCYEARMONTHDATE
  | typeof TimeUnit.UTCYEARMONTHDATEHOURS
  | typeof TimeUnit.UTCYEARMONTHDATEHOURSMINUTES
  | typeof TimeUnit.UTCYEARMONTHDATEHOURSMINUTESSECONDS
  | typeof TimeUnit.UTCQUARTERMONTH
  | typeof TimeUnit.UTCMONTHDATE
  | typeof TimeUnit.UTCMONTHDATEHOURS
  | typeof TimeUnit.UTCHOURSMINUTES
  | typeof TimeUnit.UTCHOURSMINUTESSECONDS
  | typeof TimeUnit.UTCMINUTESSECONDS
  | typeof TimeUnit.UTCSECONDSMILLISECONDS;

const UTC_MULTI_TIMEUNIT_INDEX: Flag<UtcMultiTimeUnit> = {
  utcyearquarter: 1,
  utcyearquartermonth: 1,

  utcyearmonth: 1,
  utcyearmonthdate: 1,
  utcyearmonthdatehours: 1,
  utcyearmonthdatehoursminutes: 1,
  utcyearmonthdatehoursminutesseconds: 1,

  utcquartermonth: 1,

  utcmonthdate: 1,
  utcmonthdatehours: 1,

  utchoursminutes: 1,
  utchoursminutesseconds: 1,

  utcminutesseconds: 1,

  utcsecondsmilliseconds: 1
};

export type MultiTimeUnit = LocalMultiTimeUnit | UtcMultiTimeUnit;

export type LocalTimeUnit = LocalSingleTimeUnit | LocalMultiTimeUnit;
export type UtcTimeUnit = UtcSingleTimeUnit | UtcMultiTimeUnit;

const UTC_TIMEUNIT_INDEX: Flag<UtcTimeUnit> = {
  ...UTC_SINGLE_TIMEUNIT_INDEX,
  ...UTC_MULTI_TIMEUNIT_INDEX
};

export function isUTCTimeUnit(t: string): t is UtcTimeUnit {
  return !!UTC_TIMEUNIT_INDEX[t];
}

export function getLocalTimeUnit(t: UtcTimeUnit): LocalTimeUnit {
  return t.substr(3) as LocalTimeUnit;
}

export type TimeUnit = SingleTimeUnit | MultiTimeUnit;

const TIMEUNIT_INDEX: Flag<TimeUnit> = {
  ...LOCAL_SINGLE_TIMEUNIT_INDEX,
  ...UTC_SINGLE_TIMEUNIT_INDEX,
  ...LOCAL_MULTI_TIMEUNIT_INDEX,
  ...UTC_MULTI_TIMEUNIT_INDEX
};

export const TIMEUNITS = keys(TIMEUNIT_INDEX);

export type TimeUnitFormat =
  | 'year'
  | 'year-month'
  | 'year-month-date'
  | 'quarter'
  | 'month'
  | 'date'
  | 'week'
  | 'day'
  | 'hours'
  | 'hours-minutes'
  | 'minutes'
  | 'seconds'
  | 'milliseconds';

export interface TimeUnitParams {
  /**
   * Defines how date-time values should be binned.
   */
  unit?: TimeUnit;

  /**
   * If no `unit` is specified, maxbins is used to infer time units.
   */
  maxbins?: number;

  /**
   * The number of steps between bins, in terms of the least
   * significant unit provided.
   */
  step?: number;

  /**
   * True to use UTC timezone. Equivalent to using a `utc` prefixed `TimeUnit`.
   */
  utc?: boolean;
}

// matches vega time unit format specifier
// matches vega time unit format specifier
export type TimeFormatConfig = {
  [unit in TimeUnitFormat]?: string;
};

// In order of increasing specificity
export const VEGALITE_TIMEFORMAT: TimeFormatConfig = {
  'year-month': '%b %Y ',
  'year-month-date': '%b %d, %Y '
};

export function isTimeUnit(t: string): t is TimeUnit {
  return !!TIMEUNIT_INDEX[t];
}

export function getTimeUnitParts(timeUnit: TimeUnit) {
  return TIMEUNIT_PARTS.reduce((parts, part) => {
    if (containsTimeUnit(timeUnit, part)) {
      return [...parts, part];
    }
    return parts;
  }, []);
}

/** Returns true if fullTimeUnit contains the timeUnit, false otherwise. */
export function containsTimeUnit(fullTimeUnit: TimeUnit, timeUnit: TimeUnit) {
  const index = fullTimeUnit.indexOf(timeUnit);
  return (
    index > -1 && (timeUnit !== TimeUnit.SECONDS || index === 0 || fullTimeUnit.charAt(index - 1) !== 'i') // exclude milliseconds
  );
}

/**
 * Returns Vega expresssion for a given timeUnit and fieldRef
 */
export function fieldExpr(fullTimeUnit: TimeUnit, field: string, {end}: {end: boolean} = {end: false}): string {
  const fieldRef = accessPathWithDatum(field);

  const utc = isUTCTimeUnit(fullTimeUnit) ? 'utc' : '';

  function func(timeUnit: TimeUnit) {
    if (timeUnit === TimeUnit.QUARTER) {
      // quarter starting at 0 (0,3,6,9).
      return `(${utc}quarter(${fieldRef})-1)`;
    } else {
      return `${utc}${timeUnit}(${fieldRef})`;
    }
  }

  let lastTimeUnit: TimeUnit;

  const d = TIMEUNIT_PARTS.reduce((dateExpr: DateTimeExpr, tu: TimeUnit) => {
    if (containsTimeUnit(fullTimeUnit, tu)) {
      dateExpr[tu] = func(tu);
      lastTimeUnit = tu;
    }
    return dateExpr;
  }, {} as {[key in SingleTimeUnit]: string});

  if (end) {
    d[lastTimeUnit] += '+1';
  }

  return dateTimeExprToExpr(d);
}

export function getTimeUnitSpecifierExpression(timeUnit: TimeUnit) {
  if (!timeUnit) {
    return undefined;
  }

  const timeUnitParts = getTimeUnitParts(timeUnit);
  return `timeUnitSpecifier(${stringify(timeUnitParts)}, ${stringify(VEGALITE_TIMEFORMAT)})`;
}

/**
 * returns the signal expression used for axis labels for a time unit
 */
export function formatExpression(timeUnit: TimeUnit, field: string, isUTCScale: boolean): string {
  if (!timeUnit) {
    return undefined;
  }

  const timeUnitSpecifierExpr = getTimeUnitSpecifierExpression(timeUnit);

  // We only use utcFormat for utc scale
  // For utc time units, the data is already converted as a part of timeUnit transform.
  // Thus, utc time units should use timeFormat to avoid shifting the time twice.
  if (isUTCScale || isUTCTimeUnit(timeUnit)) {
    return `utcFormat(${field}, ${timeUnitSpecifierExpr})`;
  } else {
    return `timeFormat(${field}, ${timeUnitSpecifierExpr})`;
  }
}

export function normalizeTimeUnit(timeUnit: TimeUnit | TimeUnitParams): TimeUnitParams {
  if (!timeUnit) {
    return undefined;
  }

  let params: TimeUnitParams;
  if (isString(timeUnit)) {
    params = {
      unit: correctTimeUnit(timeUnit)
    };
  } else if (isObject(timeUnit)) {
    params = {
      ...timeUnit,
      ...(timeUnit.unit ? {unit: correctTimeUnit(timeUnit.unit)} : {})
    };
  }

  if (isUTCTimeUnit(params.unit)) {
    params.utc = true;
    params.unit = getLocalTimeUnit(params.unit);
  }

  return params;
}

export function correctTimeUnit(timeUnit: TimeUnit) {
  if (timeUnit !== 'day' && timeUnit.indexOf('day') >= 0) {
    log.warn(log.message.dayReplacedWithDate(timeUnit));
    return replaceAll(timeUnit, 'day', 'date') as TimeUnit;
  }

  return timeUnit;
}

export function timeUnitToString(tu: TimeUnit | TimeUnitParams) {
  const {utc, ...rest} = normalizeTimeUnit(tu);

  if (rest.unit) {
    return (
      (utc ? 'utc' : '') +
      keys(rest)
        .map(p => varName(`${p === 'unit' ? '' : `_${p}_`}${rest[p]}`))
        .join('')
    );
  } else {
    // when maxbins is specified instead of units
    return (
      (utc ? 'utc' : '') +
      'timeunit' +
      keys(rest)
        .map(p => varName(`_${p}_${rest[p]}`))
        .join('')
    );
  }
}
