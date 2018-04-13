import parseIsoDuration from 'parse-iso-duration';


export const getPlaySliderParams = function (timestamps, timeGrain) {
  let start = Math.min(...timestamps);
  let end = Math.max(...timestamps);

  // lock start and end to the closest steps
  const step = parseIsoDuration(timeGrain);
  start -= start % step;
  end += step - end % step;

  const values = timeGrain != null ? [start, start + step] : [start, end];
  const disabled = timestamps.every(timestamp => timestamp === null);

  return { start, end, step, values, disabled };
};

