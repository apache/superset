declare namespace Intl {
  class DurationFormat {
    constructor(locale?: string | string[], options?: DurationFormatOptions);
    format(duration: DurationObject): string;
    formatToParts(
      duration: DurationObject,
    ): { type: string; value: string; unit?: string }[];
    resolvedOptions(): ResolvedDurationFormatOptions;
  }

  interface DurationObject {
    years?: number;
    months?: number;
    weeks?: number;
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
    milliseconds?: number;
    microseconds?: number;
    nanoseconds?: number;
  }

  interface DurationFormatOptions {
    localeMatcher?: 'lookup' | 'best fit';
    numberingSystem?: string;
    style?: 'long' | 'short' | 'narrow' | 'digital';
    years?: 'long' | 'short' | 'narrow';
    yearsDisplay?: 'always' | 'auto';
    months?: 'long' | 'short' | 'narrow';
    monthsDisplay?: 'always' | 'auto';
    weeks?: 'long' | 'short' | 'narrow';
    weeksDisplay?: 'always' | 'auto';
    days?: 'long' | 'short' | 'narrow';
    daysDisplay?: 'always' | 'auto';
    hours?: 'long' | 'short' | 'narrow' | 'numeric' | '2-digit';
    hoursDisplay?: 'always' | 'auto';
    minutes?: 'long' | 'short' | 'narrow' | 'numeric' | '2-digit';
    minutesDisplay?: 'always' | 'auto';
    seconds?: 'long' | 'short' | 'narrow' | 'numeric' | '2-digit';
    secondsDisplay?: 'always' | 'auto';
    milliseconds?: 'long' | 'short' | 'narrow' | 'numeric';
    millisecondsDisplay?: 'always' | 'auto';
    microseconds?: 'long' | 'short' | 'narrow' | 'numeric';
    microsecondsDisplay?: 'always' | 'auto';
    nanoseconds?: 'long' | 'short' | 'narrow' | 'numeric';
    nanosecondsDisplay?: 'always' | 'auto';
    fractionalDigits?: number;
  }

  interface ResolvedDurationFormatOptions extends DurationFormatOptions {
    locale: string;
  }
}
