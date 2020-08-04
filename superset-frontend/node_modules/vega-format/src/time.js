import memoize from './memoize';
import {
  DATE, DAY, HOURS, MILLISECONDS, MINUTES, MONTH, QUARTER,
  SECONDS, WEEK, YEAR, timeInterval, utcInterval
} from 'vega-time';
import {error, isObject, isString} from 'vega-util';

import {
  timeFormat as d3_timeFormat,
  timeFormatLocale as d3_timeFormatLocale,
  timeParse as d3_timeParse,
  utcFormat as d3_utcFormat,
  utcParse as d3_utcParse
} from 'd3-time-format';

function timeMultiFormat(format, interval, spec) {
  spec = spec || {};
  if (!isObject(spec)) {
    error(`Invalid time multi-format specifier: ${spec}`);
  }

  const second = interval(SECONDS),
        minute = interval(MINUTES),
        hour = interval(HOURS),
        day = interval(DATE),
        week = interval(WEEK),
        month = interval(MONTH),
        quarter = interval(QUARTER),
        year = interval(YEAR),
        L = format(spec[MILLISECONDS] || '.%L'),
        S = format(spec[SECONDS] || ':%S'),
        M = format(spec[MINUTES] || '%I:%M'),
        H = format(spec[HOURS] || '%I %p'),
        d = format(spec[DATE] || spec[DAY] || '%a %d'),
        w = format(spec[WEEK] || '%b %d'),
        m = format(spec[MONTH] || '%B'),
        q = format(spec[QUARTER] || '%B'),
        y = format(spec[YEAR] || '%Y');

  return date => (
    second(date) < date ? L :
    minute(date) < date ? S :
    hour(date) < date ? M :
    day(date) < date ? H :
    month(date) < date ? (week(date) < date ? d : w) :
    year(date) < date ? (quarter(date) < date ? m : q) :
    y)(date);
}

function timeLocale(locale) {
  const timeFormat = memoize(locale.format),
        utcFormat = memoize(locale.utcFormat);

  return {
    timeFormat: spec => isString(spec)
      ? timeFormat(spec)
      : timeMultiFormat(timeFormat, timeInterval, spec),
    utcFormat: spec => isString(spec)
      ? utcFormat(spec)
      : timeMultiFormat(utcFormat, utcInterval, spec),
    timeParse: memoize(locale.parse),
    utcParse: memoize(locale.utcParse)
  };
}

let defaultTimeLocale;
resetTimeFormatDefaultLocale();

export function resetTimeFormatDefaultLocale() {
  return defaultTimeLocale = timeLocale({
    format: d3_timeFormat,
    parse: d3_timeParse,
    utcFormat: d3_utcFormat,
    utcParse: d3_utcParse
  });
}

export function timeFormatLocale(definition) {
  return timeLocale(d3_timeFormatLocale(definition));
}

export function timeFormatDefaultLocale(definition) {
  return arguments.length
    ? (defaultTimeLocale = timeFormatLocale(definition))
    : defaultTimeLocale;
}
