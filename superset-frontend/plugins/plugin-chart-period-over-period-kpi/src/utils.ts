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

import { AdhocFilter } from '@superset-ui/core';
import moment, { Moment } from 'moment';

type MomentTuple = [moment.Moment | null, moment.Moment | null];

const getSinceUntil = (
  timeRange: string | null = null,
  relativeStart: string | null = null,
  relativeEnd: string | null = null,
): MomentTuple => {
  const separator = ' : ';
  const effectiveRelativeStart = relativeStart || 'today';
  const effectiveRelativeEnd = relativeEnd || 'today';

  if (!timeRange) {
    return [null, null];
  }

  let modTimeRange: string | null = timeRange;

  if (timeRange === 'NO_TIME_RANGE' || timeRange === '_(NO_TIME_RANGE)') {
    return [null, null];
  }

  if (timeRange?.startsWith('last') && !timeRange.includes(separator)) {
    modTimeRange = timeRange + separator + effectiveRelativeEnd;
  }

  if (timeRange?.startsWith('next') && !timeRange.includes(separator)) {
    modTimeRange = effectiveRelativeStart + separator + timeRange;
  }

  if (
    timeRange?.startsWith('previous calendar week') &&
    !timeRange.includes(separator)
  ) {
    return [
      moment().subtract(1, 'week').startOf('week'),
      moment().startOf('week'),
    ];
  }

  if (
    timeRange?.startsWith('previous calendar month') &&
    !timeRange.includes(separator)
  ) {
    return [
      moment().subtract(1, 'month').startOf('month'),
      moment().startOf('month'),
    ];
  }

  if (
    timeRange?.startsWith('previous calendar year') &&
    !timeRange.includes(separator)
  ) {
    return [
      moment().subtract(1, 'year').startOf('year'),
      moment().startOf('year'),
    ];
  }

  const timeRangeLookup: Array<[RegExp, (...args: string[]) => Moment]> = [
    [
      /^last\s+(day|week|month|quarter|year)$/i,
      (unit: string) =>
        moment().subtract(1, unit as moment.unitOfTime.DurationConstructor),
    ],
    [
      /^last\s+([0-9]+)\s+(second|minute|hour|day|week|month|year)s?$/i,
      (delta: string, unit: string) =>
        moment().subtract(delta, unit as moment.unitOfTime.DurationConstructor),
    ],
    [
      /^next\s+([0-9]+)\s+(second|minute|hour|day|week|month|year)s?$/i,
      (delta: string, unit: string) =>
        moment().add(delta, unit as moment.unitOfTime.DurationConstructor),
    ],
    [
      // eslint-disable-next-line no-useless-escape
      /DATEADD\(DATETIME\("([^"]+)"\),\s*(-?\d+),\s*([^\)]+)\)/i,
      (timePart: string, delta: string, unit: string) => {
        if (timePart === 'now') {
          return moment().add(
            delta,
            unit as moment.unitOfTime.DurationConstructor,
          );
        }
        if (moment(timePart.toUpperCase(), true).isValid()) {
          return moment(timePart).add(
            delta,
            unit as moment.unitOfTime.DurationConstructor,
          );
        }
        return moment();
      },
    ],
  ];

  const sinceAndUntilPartition = modTimeRange
    .split(separator, 2)
    .map(part => part.trim());

  const sinceAndUntil: (Moment | null)[] = sinceAndUntilPartition.map(part => {
    if (!part) {
      return null;
    }

    let transformedValue: Moment | null = null;
    // Matching time_range_lookup
    const matched = timeRangeLookup.some(([pattern, fn]) => {
      const result = part.match(pattern);
      if (result) {
        transformedValue = fn(...result.slice(1));
        return true;
      }

      if (part === 'today') {
        transformedValue = moment().startOf('day');
        return true;
      }

      if (part === 'now') {
        transformedValue = moment();
        return true;
      }
      return false;
    });

    if (matched && transformedValue !== null) {
      // Handle the transformed value
    } else {
      // Handle the case when there was no match
      transformedValue = moment(`${part}`);
    }

    return transformedValue;
  });

  const [_since, _until] = sinceAndUntil;

  if (_since && _until && _since.isAfter(_until)) {
    throw new Error('From date cannot be larger than to date');
  }

  return [_since, _until];
};

const calculatePrev = (
  startDate: Moment | null,
  endDate: Moment | null,
  calcType: String,
) => {
  if (!startDate || !endDate) {
    return [null, null];
  }

  const daysBetween = endDate.diff(startDate, 'days');

  let startDatePrev = moment();
  let endDatePrev = moment();
  if (calcType === 'y') {
    startDatePrev = startDate.subtract(1, 'year');
    endDatePrev = endDate.subtract(1, 'year');
  } else if (calcType === 'w') {
    startDatePrev = startDate.subtract(1, 'week');
    endDatePrev = endDate.subtract(1, 'week');
  } else if (calcType === 'm') {
    startDatePrev = startDate.subtract(1, 'month');
    endDatePrev = endDate.subtract(1, 'month');
  } else if (calcType === 'r') {
    startDatePrev = startDate.clone().subtract(daysBetween.valueOf(), 'day');
    endDatePrev = startDate;
  } else {
    startDatePrev = startDate.subtract(1, 'year');
    endDatePrev = endDate.subtract(1, 'year');
  }

  return [startDatePrev, endDatePrev];
};

export const computeQueryBComparator = (
  adhocFilters: AdhocFilter[],
  timeComparison: string,
  extraFormData: any,
  join = ':',
) => {
  const timeFilterIndex =
    adhocFilters?.findIndex(
      filter => 'operator' in filter && filter.operator === 'TEMPORAL_RANGE',
    ) ?? -1;

  const timeFilter =
    timeFilterIndex !== -1 ? adhocFilters[timeFilterIndex] : null;

  let testSince = null;
  let testUntil = null;

  if (
    timeFilter &&
    'comparator' in timeFilter &&
    typeof timeFilter.comparator === 'string'
  ) {
    let timeRange = timeFilter.comparator.toLocaleLowerCase();
    if (extraFormData?.time_range) {
      timeRange = extraFormData.time_range;
    }
    [testSince, testUntil] = getSinceUntil(timeRange);
  }

  if (timeComparison !== 'c') {
    const [prevStartDateMoment, prevEndDateMoment] = calculatePrev(
      testSince,
      testUntil,
      timeComparison,
    );

    return `${prevStartDateMoment?.format(
      'YYYY-MM-DDTHH:mm:ss',
    )} ${join} ${prevEndDateMoment?.format('YYYY-MM-DDTHH:mm:ss')}`.replace(
      /Z/g,
      '',
    );
  }

  return null;
};
