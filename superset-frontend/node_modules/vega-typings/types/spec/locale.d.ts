import { Vector2, Vector7, Vector10, Vector12 } from '.';

export interface Locale {
  number?: NumberLocale;
  time?: TimeLocale;
}

/**
 * Locale definition for formatting numbers.
 */
export interface NumberLocale {
  /**
   * The decimal point (e.g., ".").
   */
  decimal: string;
  /**
   * The group separator (e.g., ",").
   */
  thousands: string;
  /**
   * The array of group sizes (e.g., [3]), cycled as needed.
   */
  grouping: number[];
  /**
   * The currency prefix and suffix (e.g., ["$", ""]).
   */
  currency: Vector2<string>;
  /**
   * An array of ten strings to replace the numerals 0-9.
   */
  numerals?: Vector10<string>;
  /**
   * The percent sign (defaults to "%").
   */
  percent?: string;
  /**
   * The minus sign (defaults to hyphen-minus, "-").
   */
  minus?: string;
  /**
   * The not-a-number value (defaults to "NaN").
   */
  nan?: string;
}

/**
 * Locale definition for formatting dates and times.
 */
export interface TimeLocale {
  /**
   * The date and time (%c) format specifier (e.g., "%a %b %e %X %Y").
   */
  dateTime: string;
  /**
   * The date (%x) format specifier (e.g., "%m/%d/%Y").
   */
  date: string;
  /**
   * The time (%X) format specifier (e.g., "%H:%M:%S").
   */
  time: string;
  /**
   * The A.M. and P.M. equivalents (e.g., ["AM", "PM"]).
   */
  periods: Vector2<string>;
  /**
   * The full names of the weekdays, starting with Sunday.
   */
  days: Vector7<string>;
  /**
   * The abbreviated names of the weekdays, starting with Sunday.
   */
  shortDays: Vector7<string>;
  /**
   * The full names of the months (starting with January).
   */
  months: Vector12<string>;
  /**
   * The abbreviated names of the months (starting with January).
   */
  shortMonths: Vector12<string>;
}
