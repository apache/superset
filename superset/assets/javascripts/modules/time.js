const SECOND = 1000;  // milliseconds
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;
const QUARTER = YEAR / 4;

const unitsToMilliSeconds = {
  second: SECOND,
  minute: MINUTE,
  hour: HOUR,
  'half hour': HOUR / 2,  // mssql
  day: DAY,
  week: WEEK,
  month: MONTH,
  quarter: QUARTER,
  year: YEAR,
};

const pattern = new RegExp('^(\\d+)?\\s*(.*)$');

export const parseTimeGrain = function (timeGrain) {
  const match = pattern.exec(timeGrain);
  const number = match[1] || 1;
  const units = match[2];

  let compiled;
  let milliseconds = null;
  Object.entries(unitsToMilliSeconds).forEach(([k, v]) => {
    compiled = new RegExp(k);
    if (compiled.test(units)) {
      milliseconds = number * v;
    }
  });
  return milliseconds;
};
