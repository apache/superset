import {timeDay, timeWeek, utcDay, utcWeek} from 'd3-time';

const t0 = new Date;

function localYear(y) {
  t0.setFullYear(y);
  t0.setMonth(0);
  t0.setDate(1);
  t0.setHours(0, 0, 0, 0);
  return t0;
}

export function dayofyear(d) {
  return localDayOfYear(new Date(d));
}

export function week(d) {
  return localWeekNum(new Date(d));
}

export function localDayOfYear(d) {
  return timeDay.count(localYear(d.getFullYear()) - 1, d);
}

export function localWeekNum(d) {
  return timeWeek.count(localYear(d.getFullYear()) - 1, d);
}

export function localFirst(y) {
  return localYear(y).getDay();
}

export function localDate(y, m, d, H, M, S, L) {
  if (0 <= y && y < 100) {
    var date = new Date(-1, m, d, H, M, S, L);
    date.setFullYear(y);
    return date;
  }
  return new Date(y, m, d, H, M, S, L);
}

export function utcdayofyear(d) {
  return utcDayOfYear(new Date(d));
}

export function utcweek(d) {
  return utcWeekNum(new Date(d));
}

export function utcDayOfYear(d) {
  const y = Date.UTC(d.getUTCFullYear(), 0, 1);
  return utcDay.count(y - 1, d);
}

export function utcWeekNum(d) {
  const y = Date.UTC(d.getUTCFullYear(), 0, 1);
  return utcWeek.count(y - 1, d);
}

export function utcFirst(y) {
  t0.setTime(Date.UTC(y, 0, 1));
  return t0.getUTCDay();
}

export function utcDate(y, m, d, H, M, S, L) {
  if (0 <= y && y < 100) {
    var date = new Date(Date.UTC(-1, m, d, H, M, S, L));
    date.setUTCFullYear(d.y);
    return date;
  }
  return new Date(Date.UTC(y, m, d, H, M, S, L));
}
