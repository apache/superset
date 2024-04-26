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
import { getTimeOffset, parseDttmToMoment } from '@superset-ui/core';
import moment from 'moment';

describe('parseDttmToMoment', () => {
  it('should handle "now"', () => {
    const now = parseDttmToMoment('now');
    expect(now.utc().format()).toEqual(
      moment().utc().startOf('second').format(),
    );
  });

  it('should handle "today" and "No filter"', () => {
    const today = parseDttmToMoment('today');
    const noFilter = parseDttmToMoment('No filter');
    const expected = moment().utc().startOf('day').format();
    expect(today.format()).toEqual(expected);
    expect(noFilter.format()).toEqual(expected);
  });

  it('should handle relative time strings', () => {
    const lastWeek = parseDttmToMoment('Last week');
    const lastMonth = parseDttmToMoment('Last month');
    const lastQuarter = parseDttmToMoment('Last quarter');
    const lastYear = parseDttmToMoment('Last year');
    expect(lastWeek.format()).toEqual(
      moment().utc().startOf('day').subtract(7, 'days').format(),
    );
    expect(lastMonth.format()).toEqual(
      moment().utc().startOf('day').subtract(1, 'months').format(),
    );
    expect(lastQuarter.format()).toEqual(
      moment().utc().startOf('day').subtract(1, 'quarters').format(),
    );
    expect(lastYear.format()).toEqual(
      moment().utc().startOf('day').subtract(1, 'years').format(),
    );
  });

  it('should handle previous calendar units', () => {
    const previousWeek = parseDttmToMoment('previous calendar week');
    const previousMonth = parseDttmToMoment('previous calendar month');
    const previousYear = parseDttmToMoment('previous calendar year');
    expect(previousWeek.format()).toEqual(
      moment().utc().subtract(1, 'weeks').startOf('isoWeek').format(),
    );
    expect(previousMonth.format()).toEqual(
      moment().utc().subtract(1, 'months').startOf('month').format(),
    );
    expect(previousYear.format()).toEqual(
      moment().utc().subtract(1, 'years').startOf('year').format(),
    );
  });

  it('should handle dynamic "ago" times', () => {
    const fiveDaysAgo = parseDttmToMoment('5 days ago');
    expect(fiveDaysAgo.format()).toEqual(
      moment().utc().subtract(5, 'days').format(),
    );
  });

  it('should parse valid moment strings', () => {
    const specificDate = '2023-01-01';
    const parsedDate = parseDttmToMoment(specificDate);
    expect(parsedDate.format()).toEqual(moment(specificDate).format());
  });
});

describe('getTimeOffset', () => {
  it('handles custom shifts', () => {
    const shifts = ['custom'];
    const startDate = '2023-01-01';
    const timeRangeFilter = { comparator: '2023-01-03 : 2023-01-10' };

    const result = getTimeOffset(timeRangeFilter, shifts, startDate);
    expect(result).toEqual(['2 days ago']);
  });

  it('handles inherit shifts', () => {
    const shifts = ['inherit'];
    const startDate = '';
    const timeRangeFilter = { comparator: '2023-01-03 : 2023-01-10' };

    const result = getTimeOffset(timeRangeFilter, shifts, startDate);
    expect(result).toEqual(['7 days ago']);
  });

  it('handles no custom or inherit shifts', () => {
    const shifts = ['1 week ago'];
    const startDate = '';
    const timeRangeFilter = { comparator: '2023-01-03 : 2023-01-10' };

    const result = getTimeOffset(timeRangeFilter, shifts, startDate);
    expect(result).toEqual(['1 week ago']);
  });
});
