import parseMs from 'parse-ms';

interface Duration {
  years: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
  microseconds: number;
  nanoseconds: number;
}

const DAYS_IN_YEAR = 365;

/**
 * Parses milliseconds into a duration object.

 * @param ms - The number of milliseconds to parse
 * @returns A duration object containing years, days, hours, minutes, seconds,
 *          milliseconds, microseconds, and nanoseconds (1 year = 365 days)
 * @example
 * // Parse a complex duration
 * parseMilliseconds(90061000);
 * // { years: 0, days: 1, hours: 1, minutes: 1, seconds: 1, milliseconds: 0, ... }
 */
export function parseMilliseconds(ms: number): Duration {
  const parsed = parseMs(ms);
  const totalDays = parsed.days;
  const years = Math.floor(totalDays / DAYS_IN_YEAR);
  const remainingDays = totalDays % DAYS_IN_YEAR;

  return {
    ...parsed,
    years,
    days: remainingDays,
  };
}
