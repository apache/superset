// DateTime definition object

import {isNumber} from 'vega-util';
import * as log from './log';
import {duplicate, keys, isNumeric} from './util';

/*
 * A designated year that starts on Sunday.
 */
const SUNDAY_YEAR = 2006;

/**
 * @minimum 1
 * @maximum 12
 * @TJS-type integer
 */
export type Month = number;

/**
 * @minimum 1
 * @maximum 7
 */
export type Day = number;

/**
 * Object for defining datetime in Vega-Lite Filter.
 * If both month and quarter are provided, month has higher precedence.
 * `day` cannot be combined with other date.
 * We accept string for month and day names.
 */
export interface DateTime {
  /**
   * Integer value representing the year.
   * @TJS-type integer
   */
  year?: number;

  /**
   * Integer value representing the quarter of the year (from 1-4).
   * @minimum 1
   * @maximum 4
   * @TJS-type integer
   */
  quarter?: number;

  /**
   * One of:
   * (1) integer value representing the month from `1`-`12`. `1` represents January;
   * (2) case-insensitive month name (e.g., `"January"`);
   * (3) case-insensitive, 3-character short month name (e.g., `"Jan"`).
   */
  month?: Month | string;

  /**
   * Integer value representing the date (day of the month) from 1-31.
   * @minimum 1
   * @maximum 31
   * @TJS-type integer
   */
  date?: number;

  /**
   * Value representing the day of a week. This can be one of:
   * (1) integer value -- `1` represents Monday;
   * (2) case-insensitive day name (e.g., `"Monday"`);
   * (3) case-insensitive, 3-character short day name (e.g., `"Mon"`).
   *
   * **Warning:** A DateTime definition object with `day`** should not be combined with `year`, `quarter`, `month`, or `date`.
   */
  day?: Day | string;

  /**
   * Integer value representing the hour of a day from 0-23.
   * @minimum 0
   * @maximum 23
   * @TJS-type integer
   */
  hours?: number;

  /**
   * Integer value representing the minute segment of time from 0-59.
   * @minimum 0
   * @maximum 59
   * @TJS-type integer
   */
  minutes?: number;

  /**
   * Integer value representing the second segment (0-59) of a time value
   * @minimum 0
   * @maximum 59
   * @TJS-type integer
   */
  seconds?: number;

  /**
   * Integer value representing the millisecond segment of time.
   * @minimum 0
   * @maximum 999
   * @TJS-type integer
   */
  milliseconds?: number;

  /**
   * A boolean flag indicating if date time is in utc time. If false, the date time is in local time
   */
  utc?: boolean;
}

/**
 * Internal Object for defining datetime expressions.
 * This is an expression version of DateTime.
 * If both month and quarter are provided, month has higher precedence.
 * `day` cannot be combined with other date.
 */
export interface DateTimeExpr {
  year?: string;
  quarter?: string;
  month?: string;
  date?: string;
  day?: string;
  hours?: string;
  minutes?: string;
  seconds?: string;
  milliseconds?: string;
  utc?: boolean;
}

export function isDateTime(o: any): o is DateTime {
  return (
    !!o &&
    (!!o.year ||
      !!o.quarter ||
      !!o.month ||
      !!o.date ||
      !!o.day ||
      !!o.hours ||
      !!o.minutes ||
      !!o.seconds ||
      !!o.milliseconds)
  );
}

export const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december'
];
export const SHORT_MONTHS = MONTHS.map(m => m.substr(0, 3));

export const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export const SHORT_DAYS = DAYS.map(d => d.substr(0, 3));

function normalizeQuarter(q: number | string): number {
  if (isNumeric(q)) {
    q = +q;
  }

  if (isNumber(q)) {
    if (q > 4) {
      log.warn(log.message.invalidTimeUnit('quarter', q));
    }
    // We accept 1-based quarter, so need to readjust to 0-based quarter
    return q - 1;
  } else {
    // Invalid quarter
    throw new Error(log.message.invalidTimeUnit('quarter', q));
  }
}

function normalizeMonth(m: string | number): number {
  if (isNumeric(m)) {
    m = +m;
  }

  if (isNumber(m)) {
    // We accept 1-based month, so need to readjust to 0-based month
    return m - 1;
  } else {
    const lowerM = m.toLowerCase();
    const monthIndex = MONTHS.indexOf(lowerM);
    if (monthIndex !== -1) {
      return monthIndex; // 0 for january, ...
    }
    const shortM = lowerM.substr(0, 3);
    const shortMonthIndex = SHORT_MONTHS.indexOf(shortM);
    if (shortMonthIndex !== -1) {
      return shortMonthIndex;
    }

    // Invalid month
    throw new Error(log.message.invalidTimeUnit('month', m));
  }
}

function normalizeDay(d: string | number): number {
  if (isNumeric(d)) {
    d = +d;
  }

  if (isNumber(d)) {
    // mod so that this can be both 0-based where 0 = sunday
    // and 1-based where 7=sunday
    return d % 7;
  } else {
    const lowerD = d.toLowerCase();
    const dayIndex = DAYS.indexOf(lowerD);
    if (dayIndex !== -1) {
      return dayIndex; // 0 for january, ...
    }
    const shortD = lowerD.substr(0, 3);
    const shortDayIndex = SHORT_DAYS.indexOf(shortD);
    if (shortDayIndex !== -1) {
      return shortDayIndex;
    }
    // Invalid day
    throw new Error(log.message.invalidTimeUnit('day', d));
  }
}

/**
 * @param d the date.
 * @param normalize whether to normalize quarter, month, day. This should probably be true if d is a DateTime.
 * @returns array of date time parts [year, month, day, hours, minutes, seconds, milliseconds]
 */
function dateTimeParts(d: DateTime | DateTimeExpr, normalize: boolean) {
  const parts: (string | number)[] = [];

  if (normalize && d.day !== undefined) {
    if (keys(d).length > 1) {
      log.warn(log.message.droppedDay(d));
      d = duplicate(d);
      delete d.day;
    }
  }

  if (d.year !== undefined) {
    parts.push(d.year);
  } else if (d.day !== undefined) {
    // Set year to 2006 for working with day since January 1 2006 is a Sunday
    parts.push(SUNDAY_YEAR);
  } else {
    parts.push(0);
  }

  if (d.month !== undefined) {
    const month = normalize ? normalizeMonth(d.month) : d.month;
    parts.push(month);
  } else if (d.quarter !== undefined) {
    const quarter = normalize ? normalizeQuarter(d.quarter) : d.quarter;
    parts.push(isNumber(quarter) ? quarter * 3 : quarter + '*3');
  } else {
    parts.push(0); // months start at zero in JS
  }

  if (d.date !== undefined) {
    parts.push(d.date);
  } else if (d.day !== undefined) {
    // HACK: Day only works as a standalone unit
    // This is only correct because we always set year to 2006 for day
    const day = normalize ? normalizeDay(d.day) : d.day;
    parts.push(isNumber(day) ? day + 1 : day + '+1');
  } else {
    parts.push(1); // Date starts at 1 in JS
  }

  // Note: can't use TimeUnit enum here as importing it will create
  // circular dependency problem!
  for (const timeUnit of ['hours', 'minutes', 'seconds', 'milliseconds'] as const) {
    const unit = d[timeUnit];
    parts.push(typeof unit === 'undefined' ? 0 : unit);
  }

  return parts;
}

/**
 * Return Vega expression for a date time.
 *
 * @param d the date time.
 * @returns the Vega expression.
 */
export function dateTimeToExpr(d: DateTime) {
  const parts: (string | number)[] = dateTimeParts(d, true);

  const string = parts.join(', ');

  if (d.utc) {
    return `utc(${string})`;
  } else {
    return `datetime(${string})`;
  }
}

/**
 * Return Vega expression for a date time expression.
 *
 * @param d the internal date time object with expression.
 * @returns the Vega expression.
 */
export function dateTimeExprToExpr(d: DateTimeExpr) {
  const parts: (string | number)[] = dateTimeParts(d, false);

  const string = parts.join(', ');

  if (d.utc) {
    return `utc(${string})`;
  } else {
    return `datetime(${string})`;
  }
}

/**
 * @param d the date time.
 * @returns the timestamp.
 */
export function dateTimeToTimestamp(d: DateTime) {
  const parts: (string | number)[] = dateTimeParts(d, true);

  if (d.utc) {
    return +new Date(Date.UTC(...(parts as [any, any])));
  } else {
    return +new Date(...(parts as [any]));
  }
}
