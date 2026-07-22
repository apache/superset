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
  BinaryQueryObjectFilterClause,
  QueryFormColumn,
  TimeGranularity,
} from '@superset-ui/core';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Format a Date as a naive ISO datetime string (UTC, no timezone suffix),
 * the format Superset's time range parser expects, e.g. "2021-01-01T00:00:00".
 */
export const formatNaiveDateTime = (date: Date): string =>
  date.toISOString().slice(0, 19);

/**
 * Given the start (label) of a time bucket and its time grain, return the
 * [since, until) range covering the bucket, using calendar-aware UTC
 * arithmetic. Week-ending grains are labeled by the last day of the bucket,
 * so their range extends backwards from the label. Returns undefined for
 * unknown grains.
 */
export const getTimeBucketRange = (
  bucketLabel: Date,
  grain: TimeGranularity,
): { since: Date; until: Date } | undefined => {
  const until = new Date(bucketLabel.getTime());
  switch (grain) {
    case TimeGranularity.SECOND:
      until.setUTCSeconds(until.getUTCSeconds() + 1);
      break;
    case TimeGranularity.MINUTE:
      until.setUTCMinutes(until.getUTCMinutes() + 1);
      break;
    case TimeGranularity.FIVE_MINUTES:
      until.setUTCMinutes(until.getUTCMinutes() + 5);
      break;
    case TimeGranularity.TEN_MINUTES:
      until.setUTCMinutes(until.getUTCMinutes() + 10);
      break;
    case TimeGranularity.FIFTEEN_MINUTES:
      until.setUTCMinutes(until.getUTCMinutes() + 15);
      break;
    case TimeGranularity.THIRTY_MINUTES:
      until.setUTCMinutes(until.getUTCMinutes() + 30);
      break;
    case TimeGranularity.HOUR:
      until.setUTCHours(until.getUTCHours() + 1);
      break;
    case TimeGranularity.DATE:
    case TimeGranularity.DAY:
      until.setUTCDate(until.getUTCDate() + 1);
      break;
    case TimeGranularity.WEEK:
    case TimeGranularity.WEEK_STARTING_SUNDAY:
    case TimeGranularity.WEEK_STARTING_MONDAY:
      until.setUTCDate(until.getUTCDate() + 7);
      break;
    case TimeGranularity.WEEK_ENDING_SATURDAY:
    case TimeGranularity.WEEK_ENDING_SUNDAY:
      // These buckets are labeled with their last day: the bucket spans
      // the 6 days before the label plus the label day itself.
      until.setUTCDate(until.getUTCDate() + 1);
      return { since: new Date(bucketLabel.getTime() - 6 * DAY_MS), until };
    case TimeGranularity.MONTH:
      until.setUTCMonth(until.getUTCMonth() + 1);
      break;
    case TimeGranularity.QUARTER:
      until.setUTCMonth(until.getUTCMonth() + 3);
      break;
    case TimeGranularity.YEAR:
      until.setUTCFullYear(until.getUTCFullYear() + 1);
      break;
    default:
      return undefined;
  }
  return { since: new Date(bucketLabel.getTime()), until };
};

/**
 * Build a drill-by filter clause matching the clicked value on a temporal
 * x-axis. When a known time grain is active, the clause is a TEMPORAL_RANGE
 * covering the clicked bucket; otherwise it falls back to an exact match on
 * the timestamp.
 */
export const getTemporalXAxisDrillByFilter = (
  col: QueryFormColumn,
  value: unknown,
  grain?: TimeGranularity,
  formattedVal?: string,
): BinaryQueryObjectFilterClause | undefined => {
  if (
    !col ||
    (typeof value !== 'number' &&
      typeof value !== 'string' &&
      !(value instanceof Date))
  ) {
    return undefined;
  }
  const bucketLabel = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(bucketLabel.getTime())) {
    return undefined;
  }
  const range = grain ? getTimeBucketRange(bucketLabel, grain) : undefined;
  if (!range) {
    return {
      col,
      op: '==',
      val: formatNaiveDateTime(bucketLabel),
      formattedVal,
    };
  }
  return {
    col,
    op: 'TEMPORAL_RANGE',
    val: `${formatNaiveDateTime(range.since)} : ${formatNaiveDateTime(range.until)}`,
    formattedVal,
  };
};
