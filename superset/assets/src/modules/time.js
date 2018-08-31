import parseIsoDuration from 'parse-iso-duration';


export class IsoDuration {
  /*
   * Class that handles ambiguous durations like `P1M` or `P1Y`.
   */

  constructor(isoDuration) {
    this.isoDuration = isoDuration;

    // special cases not handled by parse-iso-duration
    this.pattern = /P(\d+)(M|Y)/;

    this.addTo = this.addTo.bind(this);
    this.subtractFrom = this.subtractFrom.bind(this);
    this.operateOn = this.operateOn.bind(this);
    this.truncate = this.truncate.bind(this);
    this.explode = this.explode.bind(this);
  }

  addTo(timestamp) {
    const op = (a, b) => a + b;
    return this.operateOn(op, timestamp);
  }

  subtractFrom(timestamp) {
    const op = (a, b) => a - b;
    return this.operateOn(op, timestamp);
  }

  operateOn(op, timestamp) {
    try {
      return op(timestamp, parseIsoDuration(this.isoDuration));
    } catch (error) {
      const match = this.pattern.exec(this.isoDuration);
      if (match === null) {
        throw error;
      }
      const n = parseInt(match[1], 10);  // how many months or years

      const date = new Date(timestamp);
      let year = date.getFullYear();
      let month = date.getMonth();

      if (match[2] === 'M') {
        year = op(year, Math.floor(n / 12));
        month = op(month, (n % 12));
        if (month < 0 || month > 11) {
          month = op(month, -12);
          year = op(year, 1);
        }
      } else if (match[2] === 'Y') {
        year = op(year, n);
      } else {
        throw error;  // should never happen
      }
      date.setFullYear(year);
      date.setMonth(month);
      return date.getTime();
    }
  }

  explode(timestamp) {
    // Return year, month, day, hour, minute, second, millisecond
    const date = new Date(timestamp);
    return [
      date.getFullYear(),
      date.getMonth() + 1,  // fuck Javascript
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds(),
    ];
  }

  truncate(timestamp) {
    /*
     * Truncate timestamp down to duration resolution.
     *
     *  > const duration = new IsoDuration('PT2H');  // 2 hours
     *  > const date = new Date('2018-01-01 23:37:00').getTime();
     *  > new Date(duration.truncate(date));
     *  Mon Jan 01 2018 22:00:00 GMT
     */
    const lowerBound = this.subtractFrom(timestamp);
    const explodedTimestamp = this.explode(timestamp);
    const explodedLowerBound = this.explode(lowerBound);
    let foundDifference = false;
    const args = [];
    for (let i = 0; i < explodedTimestamp.length; i++) {
      if (explodedLowerBound[i] !== explodedTimestamp[i]) {
        foundDifference = true;
      }
      if (foundDifference) {
        args.push(0);
      } else {
        args.push(explodedTimestamp[i]);
      }
    }
    // new Date('2018-01-01') == Date.UTC(2018, 1, 1);
    return Date.UTC(...args);
  }
}

export const getPlaySliderParams = function (timestamps, timeGrain) {
  const minTimestamp = Math.min(...timestamps);
  const maxTimestamp = Math.max(...timestamps);
  let step;
  let reference;

  if (timeGrain.indexOf('/') !== -1) {
    // Here, time grain is a time interval instead of a simple duration, either
    // `reference/duration` or `duration/reference`. We need to parse the
    // duration and make sure that start and end are in the right places. For
    // example, if `reference` is a Saturday and `duration` is 1 week (P1W)
    // then both start and end should be Saturdays.
    const parts = timeGrain.split('/', 2);
    if (parts[0].endsWith('Z')) {  // ISO string
      reference = new Date(parts[0]).getTime();
      step = new IsoDuration(parts[1]);
    } else {
      reference = new Date(parts[1]).getTime();
      step = new IsoDuration(parts[0]);
    }
  } else {
    step = new IsoDuration(timeGrain);
    reference = step.truncate(minTimestamp);
  }

  // find the largest `reference + n * step` smaller than the minimum timestamp
  let start = reference;
  while (start < minTimestamp) {
    start = step.addTo(start);
  }
  while (start > minTimestamp) {
    start = step.subtractFrom(start);
  }

  // find the smallest `reference + n * step` larger than the maximum timestamp
  let end = reference;
  while (end > maxTimestamp) {
    end = step.subtractFrom(end);
  }
  while (end < maxTimestamp) {
    end = step.addTo(end);
  }

  const values = timeGrain != null ? [start, step.addTo(start)] : [start, end];
  const disabled = timestamps.every(timestamp => timestamp === null);

  return { start, end, step, values, disabled };
};
