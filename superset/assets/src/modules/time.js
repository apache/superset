import parseIsoDuration from 'parse-iso-duration';


export const getPlaySliderParams = function (timestamps, timeGrain) {
  let start = Math.min(...timestamps);
  let end = Math.max(...timestamps);
  let step;

  if (timeGrain.indexOf('/') > 0) {
    // Here, time grain is a time interval instead of a simple duration, either
    // `reference/duration` or `duration/reference`. We need to parse the
    // duration and make sure that start and end are in the right places. For
    // example, if `reference` is a Saturday and `duration` is 1 week (P1W)
    // then both start and end should be Saturdays.
    const parts = timeGrain.split('/', 2);
    let reference;
    if (parts[0].endsWith('Z')) {  // ISO string
      reference = new Date(parts[0]).getTime();
      step = parseIsoDuration(parts[1]);
    } else {
      reference = new Date(parts[1]).getTime();
      step = parseIsoDuration(parts[0]);
    }
    start = reference + step * Math.floor((start - reference) / step);
    end = reference + step * (Math.floor((end - reference) / step) + 1);
  } else {
    // lock start and end to the closest steps
    step = parseIsoDuration(timeGrain);
    start -= start % step;
    end += step - end % step;
  }

  const values = timeGrain != null ? [start, start + step] : [start, end];
  const disabled = timestamps.every(timestamp => timestamp === null);

  return { start, end, step, values, disabled };
};

