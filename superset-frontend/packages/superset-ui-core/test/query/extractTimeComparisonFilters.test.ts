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
  getSinceAndUntil,
  getTimeComparisonFiltersByQueryObject,
} from '@superset-ui/core';

test('getTimeComparisonFiltersByQueryObject::ComparisonTimeRangeType.Year', () => {
  expect(
    getTimeComparisonFiltersByQueryObject(
      {
        filters: [
          { col: 'foobar', op: 'TEMPORAL_RANGE', val: 'Last year' },
          { col: 'num_col', op: '>', val: '5' },
        ],
      },
      ComparisonTimeRangeType.Year,
    ),
  ).toEqual([
    {
      col: 'foobar',
      op: 'TEMPORAL_RANGE',
      val: "DATEADD(DATEADD(DATETIME('today'), -1, year), -1, YEAR) : DATEADD(DATETIME('today'), -1, YEAR)",
    },
    { col: 'num_col', op: '>', val: '5' },
  ]);
});

test('getTimeComparisonFiltersByQueryObject::ComparisonTimeRangeType.Month', () => {
  expect(
    getTimeComparisonFiltersByQueryObject(
      {
        filters: [
          { col: 'foobar', op: 'TEMPORAL_RANGE', val: 'Last year' },
          { col: 'num_col', op: '>', val: '5' },
        ],
      },
      ComparisonTimeRangeType.Month,
    ),
  ).toEqual([
    {
      col: 'foobar',
      op: 'TEMPORAL_RANGE',
      val: "DATEADD(DATEADD(DATETIME('today'), -1, year), -1, MONTH) : DATEADD(DATETIME('today'), -1, MONTH)",
    },
    { col: 'num_col', op: '>', val: '5' },
  ]);
});

test('getTimeComparisonFiltersByQueryObject::ComparisonTimeRangeType.Week', () => {
  expect(
    getTimeComparisonFiltersByQueryObject(
      {
        filters: [
          { col: 'foobar', op: 'TEMPORAL_RANGE', val: 'Last year' },
          { col: 'num_col', op: '>', val: '5' },
        ],
      },
      ComparisonTimeRangeType.Week,
    ),
  ).toEqual([
    {
      col: 'foobar',
      op: 'TEMPORAL_RANGE',
      val: "DATEADD(DATEADD(DATETIME('today'), -1, year), -1, WEEK) : DATEADD(DATETIME('today'), -1, WEEK)",
    },
    { col: 'num_col', op: '>', val: '5' },
  ]);
});

test('getTimeComparisonFiltersByQueryObject::ComparisonTimeRangeType.InheritedRange', () => {
  expect(
    getTimeComparisonFiltersByQueryObject(
      {
        filters: [
          { col: 'foobar', op: 'TEMPORAL_RANGE', val: 'Last year' },
          { col: 'num_col', op: '>', val: '5' },
        ],
      },
      ComparisonTimeRangeType.InheritedRange,
    ),
  ).toEqual([
    {
      col: 'foobar',
      op: 'TEMPORAL_RANGE',
      val: "DATEADD(DATEADD(DATETIME('today'), -1, year), DATEDIFF(DATETIME('today'), DATEADD(DATETIME('today'), -1, year)), DAY) : DATEADD(DATETIME('today'), DATEDIFF(DATETIME('today'), DATEADD(DATETIME('today'), -1, year)), DAY)",
    },
    { col: 'num_col', op: '>', val: '5' },
  ]);
});

test('multiple time ranges', () => {
  expect(
    getTimeComparisonFiltersByQueryObject(
      {
        filters: [
          { col: 'foobar', op: 'TEMPORAL_RANGE', val: 'Last year' },
          { col: 'num_col', op: '>', val: '5' },
          {
            col: 'the_second_time_column',
            op: 'TEMPORAL_RANGE',
            val: '2021-01-01 : 2021-01-15',
          },
        ],
      },
      ComparisonTimeRangeType.Year,
    ),
  ).toEqual([
    {
      col: 'foobar',
      op: 'TEMPORAL_RANGE',
      val: "DATEADD(DATEADD(DATETIME('today'), -1, year), -1, YEAR) : DATEADD(DATETIME('today'), -1, YEAR)",
    },
    { col: 'num_col', op: '>', val: '5' },
    {
      col: 'the_second_time_column',
      op: 'TEMPORAL_RANGE',
      val: "DATEADD(DATETIME('2021-01-01'), -1, YEAR) : DATEADD(DATETIME('2021-01-15'), -1, YEAR)",
    },
  ]);
});

test('No Filter', () => {
  expect(
    getTimeComparisonFiltersByQueryObject(
      {
        filters: [
          { col: 'foobar', op: 'TEMPORAL_RANGE', val: 'No filter' },
          { col: 'num_col', op: '>', val: '5' },
        ],
      },
      ComparisonTimeRangeType.Year,
    ),
  ).toEqual([
    {
      col: 'foobar',
      op: 'TEMPORAL_RANGE',
      val: 'No filter',
    },
    { col: 'num_col', op: '>', val: '5' },
  ]);
});

test('getSinceAndUntil', () => {
  expect(getSinceAndUntil('Last month')).toEqual([
    "DATEADD(DATETIME('today'), -1, month)",
    "DATETIME('today')",
  ]);

  expect(getSinceAndUntil('Last 3 weeks')).toEqual([
    "DATEADD(DATETIME('today'), -3, week)",
    "DATETIME('today')",
  ]);

  expect(getSinceAndUntil('Next 3 weeks')).toEqual([
    "DATETIME('today')",
    "DATEADD(DATETIME('today'), 3, week)",
  ]);

  expect(getSinceAndUntil('previous calendar week')).toEqual([
    "DATETRUNC(DATEADD(DATETIME('today'), -1, WEEK), WEEK)",
    "DATETRUNC(DATETIME('today'), WEEK)",
  ]);

  expect(getSinceAndUntil('previous calendar month')).toEqual([
    "DATETRUNC(DATEADD(DATETIME('today'), -1, MONTH), MONTH)",
    "DATETRUNC(DATETIME('today'), MONTH)",
  ]);

  expect(getSinceAndUntil('previous calendar year')).toEqual([
    "DATETRUNC(DATEADD(DATETIME('today'), -1, YEAR), YEAR)",
    "DATETRUNC(DATETIME('today'), YEAR)",
  ]);

  expect(
    getSinceAndUntil(
      'DATEADD(DATETIME("2024-03-03T00:00:00"), -5, day) : datetime("2024-03-03T00:00:00")',
    ),
  ).toEqual([
    'DATEADD(DATETIME("2024-03-03T00:00:00"), -5, day)',
    'datetime("2024-03-03T00:00:00")',
  ]);

  expect(getSinceAndUntil('2021 : 2022')).toEqual([
    "DATETIME('2021')",
    "DATETIME('2022')",
  ]);
});
