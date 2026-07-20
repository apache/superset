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
import { QueryFormData } from '@superset-ui/core';
import buildQuery from '../../src/TimePivot/buildQuery';
import transformData, { rollback } from '../../src/TimePivot/transformData';

test('buildQuery builds a timeseries query with the single metric', () => {
  const formData: QueryFormData = {
    datasource: '5__table',
    granularity_sqla: 'ds',
    time_range: 'Last quarter',
    viz_type: 'time_pivot',
    metric: 'sum__num',
    freq: 'W-MON',
  };
  const [query] = buildQuery(formData).queries;
  expect(query.metrics).toEqual(['sum__num']);
  expect(query.is_timeseries).toBe(true);
});

describe('TimePivot rollback', () => {
  const wed = Date.UTC(2024, 0, 10, 15, 30); // Wednesday 2024-01-10
  test.each([
    ['W-MON', Date.UTC(2024, 0, 8)],
    ['52W-MON', Date.UTC(2024, 0, 8)],
    ['W-SUN', Date.UTC(2024, 0, 7)],
    ['D', Date.UTC(2024, 0, 10)],
    ['AS', Date.UTC(2024, 0, 1)],
    ['QS', Date.UTC(2024, 0, 1)],
    ['MS', Date.UTC(2024, 0, 1)],
  ])('rolls back to the %s period start', (freq, expected) => {
    expect(rollback(wed, freq as string)).toEqual(expected);
  });

  test('rolls back to the most recent month end for M', () => {
    expect(rollback(wed, 'M')).toEqual(Date.UTC(2023, 11, 31));
    expect(rollback(Date.UTC(2024, 0, 31), 'M')).toEqual(Date.UTC(2024, 0, 31));
  });
});

describe('TimePivot transformData', () => {
  const mon1 = Date.UTC(2024, 0, 1); // Monday
  const tue1 = Date.UTC(2024, 0, 2);
  const mon2 = Date.UTC(2024, 0, 8); // next Monday
  const tue2 = Date.UTC(2024, 0, 9);

  test('pivots periods onto the latest period axis with ranks', () => {
    const data = transformData(
      [
        { __timestamp: mon1, sum__num: 1 },
        { __timestamp: tue1, sum__num: 2 },
        { __timestamp: mon2, sum__num: 3 },
        { __timestamp: tue2, sum__num: 4 },
      ],
      'sum__num',
      'W-MON',
    );
    expect(data.map(series => series.key)).toEqual(['-1', 'current']);
    const previous = data[0];
    const current = data[1];
    expect(previous.rank).toEqual(1);
    expect(previous.perc).toEqual(0.5);
    expect(current.rank).toEqual(0);
    expect(current.perc).toEqual(1);
    // the older week is shifted onto the current week's timestamps
    expect(previous.values).toEqual([
      { x: mon2, y: 1 },
      { x: tue2, y: 2 },
    ]);
    expect(current.values).toEqual([
      { x: mon2, y: 3 },
      { x: tue2, y: 4 },
    ]);
  });

  test('returns an empty list for empty input', () => {
    expect(transformData([], 'sum__num', 'W-MON')).toEqual([]);
  });
});
