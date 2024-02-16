/*
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
  getComparisonTimeShift,
} from '@superset-ui/core';
import moment from 'moment';

describe('getComparisonTimeShift', () => {
  it('shifts dates by one year when calcType is Year', () => {
    const [startDatePrev, endDatePrev] = getComparisonTimeShift(
      moment('2004-02-16'),
      moment('2024-02-16'),
      ComparisonTimeRangeType.Year,
    );
    expect(startDatePrev?.format('YYYY-MM-DD')).toBe('2003-02-16');
    expect(endDatePrev?.format('YYYY-MM-DD')).toBe('2023-02-16');
  });

  it('shifts dates by one week when calcType is Week', () => {
    const [startDatePrev, endDatePrev] = getComparisonTimeShift(
      moment('2004-02-16'),
      moment('2024-02-16'),
      ComparisonTimeRangeType.Week,
    );
    expect(startDatePrev?.format('YYYY-MM-DD')).toBe('2004-02-09');
    expect(endDatePrev?.format('YYYY-MM-DD')).toBe('2024-02-09');
  });

  it('shifts dates by one month when calcType is Month', () => {
    const [startDatePrev, endDatePrev] = getComparisonTimeShift(
      moment('2004-02-16'),
      moment('2024-02-16'),
      ComparisonTimeRangeType.Month,
    );
    expect(startDatePrev?.format('YYYY-MM-DD')).toBe('2004-01-16');
    expect(endDatePrev?.format('YYYY-MM-DD')).toBe('2024-01-16');
  });

  it('shifts dates by the range duration when calcType is Inherit Range', () => {
    const [startDatePrev, endDatePrev] = getComparisonTimeShift(
      moment('2004-02-16'),
      moment('2024-02-16'),
      ComparisonTimeRangeType.InheritedRange,
    );
    expect(startDatePrev?.format('YYYY-MM-DD')).toBe('1984-02-16');
    expect(endDatePrev?.format('YYYY-MM-DD')).toBe('2004-02-16');
  });

  it('returns null for both dates when either date is null', () => {
    const [startDatePrev, endDatePrev] = getComparisonTimeShift(
      null,
      moment('2024-02-16'),
      'y',
    );
    expect(startDatePrev).toBeNull();
    expect(endDatePrev).toBeNull();
  });
});
