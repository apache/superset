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
import { TimeGranularity } from '@superset-ui/core';

/**
 * Calculates the inclusive/exclusive temporal range for a bucket.
 * standard SQL range pattern: [start, end)
 */
export default function getTimeRangeFromGranularity(
  startTime: Date,
  granularity: TimeGranularity,
): [Date, Date] {
  const time = startTime.getTime();
  const date = startTime.getUTCDate();
  const month = startTime.getUTCMonth();
  const year = startTime.getUTCFullYear();

  // Constants
  const MS_IN_SECOND = 1000;
  const MS_IN_MINUTE = 60 * MS_IN_SECOND;
  const MS_IN_HOUR = 60 * MS_IN_MINUTE;

  switch (granularity) {
    case TimeGranularity.SECOND:
      return [startTime, new Date(time + MS_IN_SECOND)];
    case TimeGranularity.MINUTE:
      return [startTime, new Date(time + MS_IN_MINUTE)];
    case TimeGranularity.FIVE_MINUTES:
      return [startTime, new Date(time + MS_IN_MINUTE * 5)];
    case TimeGranularity.TEN_MINUTES:
      return [startTime, new Date(time + MS_IN_MINUTE * 10)];
    case TimeGranularity.FIFTEEN_MINUTES:
      return [startTime, new Date(time + MS_IN_MINUTE * 15)];
    case TimeGranularity.THIRTY_MINUTES:
      return [startTime, new Date(time + MS_IN_MINUTE * 30)];
    case TimeGranularity.HOUR:
      return [startTime, new Date(time + MS_IN_HOUR)];
    case TimeGranularity.DAY:
    case TimeGranularity.DATE:
      return [startTime, new Date(Date.UTC(year, month, date + 1))];
    case TimeGranularity.WEEK:
    case TimeGranularity.WEEK_STARTING_SUNDAY:
    case TimeGranularity.WEEK_STARTING_MONDAY:
      return [startTime, new Date(Date.UTC(year, month, date + 7))];
    case TimeGranularity.WEEK_ENDING_SATURDAY:
    case TimeGranularity.WEEK_ENDING_SUNDAY:
      // Week-ending buckets are labeled by the bucket's final day.
      return [
        new Date(Date.UTC(year, month, date - 6)),
        new Date(Date.UTC(year, month, date + 1)),
      ];
    case TimeGranularity.MONTH:
      return [startTime, new Date(Date.UTC(year, month + 1, 1))];
    case TimeGranularity.QUARTER:
      return [
        startTime,
        new Date(Date.UTC(year, Math.floor(month / 3) * 3 + 3, 1)),
      ];
    case TimeGranularity.YEAR:
      return [startTime, new Date(Date.UTC(year + 1, 0, 1))];
    default:
      return [startTime, new Date(Date.UTC(year, month, date + 1))];
  }
}
