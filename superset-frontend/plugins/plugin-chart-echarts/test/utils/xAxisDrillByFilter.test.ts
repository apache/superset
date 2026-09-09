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
import {
  formatNaiveDateTime,
  getTemporalXAxisDrillByFilter,
  getTimeBucketRange,
} from '../../src/utils/xAxisDrillByFilter';

const utc = (dateString: string) => new Date(`${dateString}Z`);

const expectRange = (
  bucketLabel: string,
  grain: TimeGranularity,
  since: string,
  until: string,
) => {
  const range = getTimeBucketRange(utc(bucketLabel), grain);
  expect(range).toBeDefined();
  expect(formatNaiveDateTime(range!.since)).toEqual(since);
  expect(formatNaiveDateTime(range!.until)).toEqual(until);
};

/* eslint jest/expect-expect: ["warn", { "assertFunctionNames": ["expect*"] }] */

test('getTimeBucketRange computes sub-daily buckets', () => {
  expectRange(
    '2021-03-14T01:59:00',
    TimeGranularity.MINUTE,
    '2021-03-14T01:59:00',
    '2021-03-14T02:00:00',
  );
  expectRange(
    '2021-03-14T01:30:00',
    TimeGranularity.THIRTY_MINUTES,
    '2021-03-14T01:30:00',
    '2021-03-14T02:00:00',
  );
  expectRange(
    '2021-03-14T23:00:00',
    TimeGranularity.HOUR,
    '2021-03-14T23:00:00',
    '2021-03-15T00:00:00',
  );
});

test('getTimeBucketRange computes daily and weekly buckets', () => {
  expectRange(
    '2021-12-31T00:00:00',
    TimeGranularity.DAY,
    '2021-12-31T00:00:00',
    '2022-01-01T00:00:00',
  );
  expectRange(
    '2021-04-26T00:00:00',
    TimeGranularity.WEEK,
    '2021-04-26T00:00:00',
    '2021-05-03T00:00:00',
  );
  expectRange(
    '2021-04-25T00:00:00',
    TimeGranularity.WEEK_STARTING_SUNDAY,
    '2021-04-25T00:00:00',
    '2021-05-02T00:00:00',
  );
});

test('getTimeBucketRange extends week-ending buckets backwards from their label', () => {
  expectRange(
    '2021-05-01T00:00:00',
    TimeGranularity.WEEK_ENDING_SATURDAY,
    '2021-04-25T00:00:00',
    '2021-05-02T00:00:00',
  );
  expectRange(
    '2021-05-02T00:00:00',
    TimeGranularity.WEEK_ENDING_SUNDAY,
    '2021-04-26T00:00:00',
    '2021-05-03T00:00:00',
  );
});

test('getTimeBucketRange respects calendar month lengths', () => {
  expectRange(
    '2021-01-01T00:00:00',
    TimeGranularity.MONTH,
    '2021-01-01T00:00:00',
    '2021-02-01T00:00:00',
  );
  expectRange(
    '2021-02-01T00:00:00',
    TimeGranularity.MONTH,
    '2021-02-01T00:00:00',
    '2021-03-01T00:00:00',
  );
  expectRange(
    '2024-02-01T00:00:00',
    TimeGranularity.MONTH,
    '2024-02-01T00:00:00',
    '2024-03-01T00:00:00',
  );
  expectRange(
    '2021-12-01T00:00:00',
    TimeGranularity.MONTH,
    '2021-12-01T00:00:00',
    '2022-01-01T00:00:00',
  );
});

test('getTimeBucketRange computes quarter and year buckets', () => {
  expectRange(
    '2021-10-01T00:00:00',
    TimeGranularity.QUARTER,
    '2021-10-01T00:00:00',
    '2022-01-01T00:00:00',
  );
  expectRange(
    '2024-01-01T00:00:00',
    TimeGranularity.YEAR,
    '2024-01-01T00:00:00',
    '2025-01-01T00:00:00',
  );
});

test('getTimeBucketRange returns undefined for unknown grains', () => {
  expect(
    getTimeBucketRange(utc('2021-01-01T00:00:00'), 'P1D2H' as TimeGranularity),
  ).toBeUndefined();
});

test('getTemporalXAxisDrillByFilter builds a temporal range for known grains', () => {
  expect(
    getTemporalXAxisDrillByFilter(
      'ds',
      utc('2021-01-01T00:00:00').getTime(),
      TimeGranularity.MONTH,
      'Jan 2021',
    ),
  ).toEqual({
    col: 'ds',
    op: 'TEMPORAL_RANGE',
    val: '2021-01-01T00:00:00 : 2021-02-01T00:00:00',
    formattedVal: 'Jan 2021',
  });
});

test('getTemporalXAxisDrillByFilter falls back to exact match without a grain', () => {
  expect(
    getTemporalXAxisDrillByFilter(
      'ds',
      utc('2021-01-01T12:34:56').getTime(),
      undefined,
      '2021-01-01 12:34:56',
    ),
  ).toEqual({
    col: 'ds',
    op: '==',
    val: '2021-01-01T12:34:56',
    formattedVal: '2021-01-01 12:34:56',
  });
});

test('getTemporalXAxisDrillByFilter preserves sub-second precision in the exact-match fallback', () => {
  expect(
    getTemporalXAxisDrillByFilter(
      'ds',
      new Date('2021-01-01T12:34:56.123Z').getTime(),
      undefined,
      '2021-01-01 12:34:56.123',
    ),
  ).toEqual({
    col: 'ds',
    op: '==',
    val: '2021-01-01T12:34:56.123',
    formattedVal: '2021-01-01 12:34:56.123',
  });
});

test('getTemporalXAxisDrillByFilter falls back to exact match for unknown grains', () => {
  expect(
    getTemporalXAxisDrillByFilter(
      'ds',
      utc('2021-01-01T00:00:00').getTime(),
      'P1D2H' as TimeGranularity,
    ),
  ).toMatchObject({ op: '==', val: '2021-01-01T00:00:00' });
});

test('getTemporalXAxisDrillByFilter accepts parseable date strings and Dates', () => {
  expect(
    getTemporalXAxisDrillByFilter(
      'ds',
      '2021-01-01T00:00:00Z',
      TimeGranularity.DAY,
    ),
  ).toMatchObject({
    op: 'TEMPORAL_RANGE',
    val: '2021-01-01T00:00:00 : 2021-01-02T00:00:00',
  });
  expect(
    getTemporalXAxisDrillByFilter(
      'ds',
      utc('2021-01-01T00:00:00'),
      TimeGranularity.DAY,
    ),
  ).toMatchObject({
    op: 'TEMPORAL_RANGE',
    val: '2021-01-01T00:00:00 : 2021-01-02T00:00:00',
  });
});

test('getTemporalXAxisDrillByFilter returns undefined for unusable input', () => {
  expect(
    getTemporalXAxisDrillByFilter('ds', 'not a date', TimeGranularity.DAY),
  ).toBeUndefined();
  expect(
    getTemporalXAxisDrillByFilter('ds', null, TimeGranularity.DAY),
  ).toBeUndefined();
  expect(
    getTemporalXAxisDrillByFilter('', 1609459200000, TimeGranularity.DAY),
  ).toBeUndefined();
});
