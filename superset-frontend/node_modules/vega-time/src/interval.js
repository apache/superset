import {
  DATE,
  DAY,
  DAYOFYEAR,
  HOURS,
  MILLISECONDS,
  MINUTES,
  MONTH,
  QUARTER,
  SECONDS,
  WEEK,
  YEAR
} from './units';

import {
  timeDay,
  timeHour,
  timeMillisecond,
  timeMinute,
  timeMonth,
  timeSecond,
  timeWeek,
  timeYear,
  utcDay,
  utcHour,
  utcMillisecond,
  utcMinute,
  utcMonth,
  utcSecond,
  utcWeek,
  utcYear
} from 'd3-time';

const timeIntervals = {
  [YEAR]:         timeYear,
  [QUARTER]:      timeMonth.every(3),
  [MONTH]:        timeMonth,
  [WEEK]:         timeWeek,
  [DATE]:         timeDay,
  [DAY]:          timeDay,
  [DAYOFYEAR]:    timeDay,
  [HOURS]:        timeHour,
  [MINUTES]:      timeMinute,
  [SECONDS]:      timeSecond,
  [MILLISECONDS]: timeMillisecond
};

const utcIntervals = {
  [YEAR]:         utcYear,
  [QUARTER]:      utcMonth.every(3),
  [MONTH]:        utcMonth,
  [WEEK]:         utcWeek,
  [DATE]:         utcDay,
  [DAY]:          utcDay,
  [DAYOFYEAR]:    utcDay,
  [HOURS]:        utcHour,
  [MINUTES]:      utcMinute,
  [SECONDS]:      utcSecond,
  [MILLISECONDS]: utcMillisecond
};

export function timeInterval(unit) {
  return timeIntervals[unit];
}

export function utcInterval(unit) {
  return utcIntervals[unit];
}

function offset(ival, date, step) {
  return ival ? ival.offset(date, step) : undefined;
}

export function timeOffset(unit, date, step) {
  return offset(timeInterval(unit), date, step);
}

export function utcOffset(unit, date, step) {
  return offset(utcInterval(unit), date, step);
}

function sequence(ival, start, stop, step) {
  return ival ? ival.range(start, stop, step) : undefined;
}

export function timeSequence(unit, start, stop, step) {
  return sequence(timeInterval(unit), start, stop, step);
}

export function utcSequence(unit, start, stop, step) {
  return sequence(utcInterval(unit), start, stop, step);
}
