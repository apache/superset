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

export const tickMultiFormat = (() => {
  const formatMillisecond = d3.time.format('.%Lms');
  const formatSecond = d3.time.format(':%Ss');
  const formatMinute = d3.time.format('%I:%M');
  const formatHour = d3.time.format('%I %p');
  const formatDay = d3.time.format('%a %d');
  const formatWeek = d3.time.format('%b %d');
  const formatMonth = d3.time.format('%B');
  const formatYear = d3.time.format('%Y');

  return function tickMultiFormatConcise(date) {
    let formatter;
    if (d3.time.second(date) < date) {
      formatter = formatMillisecond;
    } else if (d3.time.minute(date) < date) {
      formatter = formatSecond;
    } else if (d3.time.hour(date) < date) {
      formatter = formatMinute;
    } else if (d3.time.day(date) < date) {
      formatter = formatHour;
    } else if (d3.time.month(date) < date) {
      formatter = d3.time.week(date) < date ? formatDay : formatWeek;
    } else if (d3.time.year(date) < date) {
      formatter = formatMonth;
    } else {
      formatter = formatYear;
    }

    return formatter(date);
  };
})();

export const tickMultiFormatVerbose = d3.time.format.multi([
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
    '%a %b %e',
    function (d) {
      return d.getDate() >= 10;
    },
  ],
  // If not the first of the month: "Tue Mar 2"
  [
    '%a %b%e',
    function (d) {
      return d.getDate() > 1;
    },
  ],
  // If >= 10th of the month, compensate for padding : "Sun Mar 15"
  [
    '%b %Y',
    function (d) {
      return d.getMonth() !== 0 && d.getDate() === 1;
    },
  ],
  // If the first of the month: 'Mar 2020'
  [
    '%Y',
    function () {
      return true;
    },
  ],  // fall back on just year: '2020'
]);
export const formatDate = function (dttm) {
  const d = UTC(new Date(dttm));
  return tickMultiFormat(d);
};

export const formatDateVerbose = function (dttm) {
  const d = UTC(new Date(dttm));
  return tickMultiFormatVerbose(d);
};

export const formatDateThunk = function (format) {
  if (!format) {
    return formatDate;
  }

  const formatter = d3.time.format(format);
  return (dttm) => {
    const d = UTC(new Date(dttm));
    return formatter(d);
  };
};

export const fDuration = function (t1, t2, format = 'HH:mm:ss.SS') {
  const diffSec = t2 - t1;
  const duration = moment(new Date(diffSec));
  return duration.utc().format(format);
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
