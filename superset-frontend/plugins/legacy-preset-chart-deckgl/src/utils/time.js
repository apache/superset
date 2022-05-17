/* eslint-disable no-negated-condition */
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import moment from 'moment';

// array with the minimum values of each part of a timestamp -- note that
// months are zero-indexed in Javascript
const truncatePartTo = [
  1, // year
  0, // month
  1, // day
  0, // hour
  0, // minute
  0, // second
  0, // millisecond
];

export function truncate(timestamp, step) {
  /*
   * Truncate timestamp down to duration resolution.
   */
  const lowerBound = moment(timestamp).subtract(step);
  const explodedTimestamp = timestamp.toArray();
  const explodedLowerBound = lowerBound.toArray();

  const firstDiffIndex = explodedTimestamp
    .map((part, i) => explodedLowerBound[i] !== part)
    .indexOf(true);
  const dateParts = explodedTimestamp.map((part, i) => {
    if (i === firstDiffIndex) {
      // truncate down to closest `truncatePartTo[i] + n * step`
      const difference = part - explodedLowerBound[i];

      return part - ((part - truncatePartTo[i]) % difference);
    }
    if (i < firstDiffIndex || firstDiffIndex === -1) {
      return part;
    }

    return truncatePartTo[i];
  });

  return moment(dateParts);
}

function getStepSeconds(step, start) {
  /* Return number of seconds in a step.
   *
   * The step might be ambigous, eg, "1 month" has a variable number of
   * seconds, which is why we need to know the start time.
   */
  const startMillliseconds = parseInt(moment(start).format('x'), 10);
  const endMilliseconds = parseInt(moment(start).add(step).format('x'), 10);

  return endMilliseconds - startMillliseconds;
}

export function getPlaySliderParams(timestamps, timeGrain) {
  const minTimestamp = moment(
    Number(timestamps.reduce((a, b) => (a < b ? a : b))),
  );
  const maxTimestamp = moment(
    Number(timestamps.reduce((a, b) => (a > b ? a : b))),
  );
  let step;
  let reference;

  if (timeGrain.includes('/')) {
    // Here, time grain is a time interval instead of a simple duration, either
    // `reference/duration` or `duration/reference`. We need to parse the
    // duration and make sure that start and end are in the right places. For
    // example, if `reference` is a Saturday and `duration` is 1 week (P1W)
    // then both start and end should be Saturdays.
    const parts = timeGrain.split('/', 2);
    if (parts[0].endsWith('Z')) {
      // ISO string
      reference = moment(parts[0]);
      step = moment.duration(parts[1]);
    } else {
      reference = moment(parts[1]);
      step = moment.duration(parts[0]);
    }
  } else {
    step = moment.duration(timeGrain);
    reference = truncate(minTimestamp, step);
  }

  // find the largest `reference + n * step` smaller than the minimum timestamp
  let start;
  const minValue = minTimestamp.valueOf();
  for (start = reference.clone(); start.valueOf() < minValue; ) {
    start.add(step);
  }
  for (; start.valueOf() > minValue; ) {
    start.subtract(step);
  }

  // find the smallest `reference + n * step` larger than the maximum timestamp
  let end;
  const maxValue = maxTimestamp.valueOf();
  for (end = reference.clone(); end.valueOf() > maxValue; ) {
    end.subtract(step);
  }
  for (; end.valueOf() < maxValue; ) {
    end.add(step);
  }

  const values =
    timeGrain != null ? [start, start.clone().add(step)] : [start, end];
  const disabled = timestamps.every(timestamp => timestamp === null);

  return {
    start: parseInt(start.format('x'), 10),
    end: parseInt(end.format('x'), 10),
    getStep: getStepSeconds.bind(this, step),
    values: values.map(v => parseInt(v.format('x'), 10)),
    disabled,
  };
}
