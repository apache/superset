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
import {
  ComparisonTimeRangeType,
  ensureIsArray,
  QueryObject,
  QueryObjectFilterClause,
} from '@superset-ui/core';

const separator = ' : ';
const start = 'today';
const end = 'today';
const previousCalendarMap = {
  'previous calendar week':
    "DATETRUNC(DATEADD(DATETIME('today'), -1, WEEK), WEEK) : DATETRUNC(DATETIME('today'), WEEK)",
  'previous calendar month':
    "DATETRUNC(DATEADD(DATETIME('today'), -1, MONTH), MONTH) : DATETRUNC(DATETIME('today'), MONTH)",
  'previous calendar year':
    "DATETRUNC(DATEADD(DATETIME('today'), -1, YEAR), YEAR) : DATETRUNC(DATETIME('today'), YEAR)",
};
const timeRangeLookup: [RegExp, any][] = [
  [
    /^last\s+(day|week|month|quarter|year)$/i,
    (text: string, unit: string) =>
      `DATEADD(DATETIME('${start}'), -1, ${unit})`,
  ],
  [
    /^last\s+([0-9]+)\s+(second|minute|hour|day|week|month|year)s?$/i,
    (text: string, delta: string, unit: string) =>
      `DATEADD(DATETIME('${start}'), -${delta}, ${unit})`,
  ],
  [
    /^next\s+([0-9]+)\s+(second|minute|hour|day|week|month|year)s?$/i,
    (text: string, delta: string, unit: string) =>
      `DATEADD(DATETIME('${end}'), ${delta}, ${unit})`,
  ],
  [
    /^(DATETIME.*|DATEADD.*|DATETRUNC.*|LASTDAY.*|HOLIDAY.*)$/i,
    (text: string) => text,
  ],
  // any plain text should match above case
  [/^.*$/i, (text: string) => `DATETIME('${text}')`],
];

export const getShiftedTimeRange = (
  timeRange: string,
  timeShiftType: ComparisonTimeRangeType,
  start = 'today',
  end = 'today',
) => {
  // eslint-disable-next-line no-underscore-dangle
  let _timeRange = timeRange;
  if (timeRange.startsWith('Last') && !timeRange.includes(separator)) {
    _timeRange = timeRange + separator + end;
  }
  if (timeRange.startsWith('Next') && !timeRange.includes(separator)) {
    _timeRange = start + separator + timeRange;
  }
  if (timeRange.startsWith('previous') && !timeRange.includes(separator)) {
    _timeRange = previousCalendarMap[timeRange];
  }
  if (_timeRange?.includes(separator)) {
    const [since, until] = _timeRange
      .split(separator)
      .map(token => token.trim())
      .map(token => {
        const matchedPattern = timeRangeLookup.find(
          item => token.search(item[0]) > -1,
        ) as [RegExp, any];
        const args = ensureIsArray(token.match(matchedPattern[0]));
        return matchedPattern[1](...args);
      });

    let unit = 'DAY';
    let delta = '-1';
    if (timeShiftType === ComparisonTimeRangeType.Year) {
      unit = 'YEAR';
    }
    if (timeShiftType === ComparisonTimeRangeType.Month) {
      unit = 'MONTH';
    }
    if (timeShiftType === ComparisonTimeRangeType.Week) {
      unit = 'WEEK';
    }
    if (timeShiftType === ComparisonTimeRangeType.InheritedRange) {
      delta = `DATEDIFF(${until}, ${since})`;
    }
    return `DATEADD(${since}, ${delta}, ${unit})${separator}DATEADD(${until}, ${delta}, ${unit})`;
  }

  return _timeRange;
};

export const getTimeComparisonFiltersByQueryObject = (
  queryObject: QueryObject,
  timeShiftType: ComparisonTimeRangeType,
): QueryObjectFilterClause[] =>
  ensureIsArray(queryObject?.filters).map(filter => {
    if (filter.op === 'TEMPORAL_RANGE') {
      return {
        ...filter,
        val: getShiftedTimeRange(filter.val as string, timeShiftType),
      };
    }
    return filter;
  });
