import moment from 'moment';

const d3 = require('d3');

export function UTC(dttm) {
  return new Date(
    dttm.getUTCFullYear(),
    dttm.getUTCMonth(),
    dttm.getUTCDate(),
    dttm.getUTCHours(),
    dttm.getUTCMinutes(),
    dttm.getUTCSeconds(),
  );
}
export const tickMultiFormat = d3.time.format.multi([
  [
    '.%L',
    function (d) {
      return d.getMilliseconds();
    },
  ],
  // If there are millisections, show  only them
  [
    ':%S',
    function (d) {
      return d.getSeconds();
    },
  ],
  // If there are seconds, show only them
  [
    '%a %b %d, %I:%M %p',
    function (d) {
      return d.getMinutes() !== 0;
    },
  ],
  // If there are non-zero minutes, show Date, Hour:Minute [AM/PM]
  [
    '%a %b %d, %I %p',
    function (d) {
      return d.getHours() !== 0;
    },
  ],
  // If there are hours that are multiples of 3, show date and AM/PM
  [
    '%a %b %d',
    function (d) {
      return d.getDate() !== 1;
    },
  ],
  // If not the first of the month, do "month day, year."
  [
    '%B %Y',
    function (d) {
      return d.getMonth() !== 0 && d.getDate() === 1;
    },
  ],
  // If the first of the month, do "month day, year."
  [
    '%Y',
    function () {
      return true;
    },
  ],  // fall back on month, year
]);
export const formatDate = function (dttm) {
  const d = UTC(new Date(dttm));
  // d = new Date(d.getTime() - 1 * 60 * 60 * 1000);
  return tickMultiFormat(d);
};
export const fDuration = function (t1, t2, f = 'HH:mm:ss.SS') {
  const diffSec = t2 - t1;
  const duration = moment(new Date(diffSec));
  return duration.utc().format(f);
};

export const now = function () {
  // seconds from EPOCH as a float
  return moment().utc().valueOf();
};

export const epochTimeXHoursAgo = function (h) {
  return moment()
    .subtract(h, 'hours')
    .utc()
    .valueOf();
};

export const epochTimeXDaysAgo = function (d) {
  return moment()
    .subtract(d, 'days')
    .utc()
    .valueOf();
};

export const epochTimeXYearsAgo = function (y) {
  return moment()
    .subtract(y, 'years')
    .utc()
    .valueOf();
};

/**
 * Converts all kinds of "durations" or "granularities" to milliseconds
 * from Epoch
 * @param granularity in all kinds of formats:
 * integer (milliseconds), SQL granularities, strings of integer, period granularities ISO8601
 * human readable ("1 hour", "5 years")
 * @returns {number} milliseconds from Epoch, 0 if it couldn't parse the input.
 */
export function granularityToEpoch(granularity) {
  let epoch = 0;
  if (granularity) {
    epoch = moment.duration(granularity).asMilliseconds();
    if (!epoch && typeof granularity === 'string') {
      const gran = granularity.trim();
      if (gran.match(/^[0-9]*$/)) { // this covers strings containing only numbers
        epoch = moment.duration(Number.parseInt(gran, 10)).asMilliseconds();
      }
      if (!epoch && gran) {
        // this covers human readable stuff like like "1 year", "5 seconds"
        const t = gran.match(/^[0-9]*\s*/);
        if (t && t.length && t[0].length) {
          const num = t[0];
          const unit = gran.slice(num.length);
          epoch = moment.duration(Number.parseInt(num, 10), unit).asMilliseconds();
        }
        if (!epoch) { // this covers SQL like granularities ["month", "week", ...]
          epoch = moment.duration(1, gran).asMilliseconds();
        }
        if (!epoch) {
          if (gran.toLowerCase() === 'fifteen_minute') {
            epoch = moment.duration(15, 'minutes').asMilliseconds();
          } else if (gran.toLowerCase() === 'thirty_minute') {
            epoch = moment.duration(30, 'minutes').asMilliseconds();
          }
        }
      }
    }
  }
  return epoch;
}
