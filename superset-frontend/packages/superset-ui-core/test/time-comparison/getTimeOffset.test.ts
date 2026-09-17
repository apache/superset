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

import { getTimeOffset } from '@superset-ui/core';
import timezoneMock from 'timezone-mock';

// NOW will be set at midnight 2024-06-03 and transforme dfrom local timezone to UTC
const NOW_IN_UTC = '2024-06-03T00:00:00Z';
const NOW_UTC_IN_EUROPE = '2024-06-02T22:00:00Z'; // Same as 2024-06-03T00:00:00+02:00
const NOW_UTC_IN_PACIFIC = '2024-06-03T08:00:00Z'; // Same as 2024-06-03T00:00:00-08:00

afterEach(() => {
  timezoneMock.unregister();
  jest.useRealTimers();
});

const runTimezoneTest = (
  now_time: string,
  timezone: any,
  timeRangeFilter: any,
  shifts: any,
  startDate: any,
  expected_result: string[],
  includeFutureOffsets = true,
) => {
  jest.setSystemTime(new Date(now_time));
  timezoneMock.register(timezone);
  const result = getTimeOffset({
    timeRangeFilter,
    shifts,
    startDate,
    includeFutureOffsets,
  });
  expect(result).toEqual(expected_result);
  timezoneMock.unregister();
};

test('should handle includeFutureOffsets is null', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(NOW_UTC_IN_EUROPE));
  timezoneMock.register('Etc/GMT-2');
  const result = getTimeOffset({
    timeRangeFilter: {
      comparator: '2024-06-03 : 2024-06-10',
    },
    shifts: ['custom'],
    startDate: '2024-05-29',
  });
  expect(result).toEqual(['5 days ago']);
  timezoneMock.unregister();
});

test('should handle custom range with specific dates', () => {
  const timeRangeFilter = {
    comparator: '2024-06-03 : 2024-06-10',
  };
  const shifts = ['custom'];
  const startDate = '2024-05-29';
  jest.useFakeTimers();

  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['5 days ago'],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, [
    '5 days ago',
  ]);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['5 days ago'],
  );
});

test('should handle custom range with relative dates (now)', () => {
  const timeRangeFilter = {
    comparator: 'now : 2024-06-10',
  };
  const shifts = ['custom'];
  const startDate = '2024-05-30';
  jest.useFakeTimers();

  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['4 days ago'],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, [
    '4 days ago',
  ]);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['4 days ago'],
  );
});

test('should handle inherit shift', () => {
  const timeRangeFilter = {
    comparator: '2024-03-01 : 2024-03-08',
  };
  const shifts = ['inherit'];
  const startDate = '2024-03-06';
  jest.useFakeTimers();
  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['7 days ago'],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, [
    '7 days ago',
  ]);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['7 days ago'],
  );
});

test('should handle custom and inherit shifts', () => {
  const timeRangeFilter = {
    comparator: '2024-06-03 : 2024-06-10',
  };
  const shifts = ['custom', 'inherit'];
  const startDate = '2024-05-28';
  jest.useFakeTimers();
  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['6 days ago', '7 days ago'],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, [
    '6 days ago',
    '7 days ago',
  ]);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['6 days ago', '7 days ago'],
  );
});

test('should handle no shifts', () => {
  const timeRangeFilter = {
    comparator: '2024-03-01 : 2024-03-05',
  };
  const shifts: any = [];
  const startDate = '2024-03-06';
  jest.useFakeTimers();
  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    [],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, []);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    [],
  );
});

test('should handle null timeRangeFilter', () => {
  const timeRangeFilter = null;
  const shifts = ['custom'];
  const startDate = '2024-06-01';
  jest.useFakeTimers();
  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['2 days ago'],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, [
    '2 days ago',
  ]);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['2 days ago'],
  );
});

test('should handle predefined shifts', () => {
  const timeRangeFilter = {
    comparator: '2024-03-01 : 2024-03-05',
  };
  const shifts: any = ['1 year ago'];
  const startDate = '2024-03-06';
  jest.useFakeTimers();

  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['1 year ago'],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, [
    '1 year ago',
  ]);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['1 year ago'],
  );
});

test('should handle custom range with DATEADD function', () => {
  const timeRangeFilter = {
    comparator:
      'DATEADD(DATETIME("2024-05-30T00:00:00"), -7, day) : 2024-05-30T00:00:00',
  };
  const shifts = ['custom'];
  const startDate = '2024-05-21';
  jest.useFakeTimers();
  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['2 days ago'],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, [
    '2 days ago',
  ]);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['2 days ago'],
  );
});

test('should handle custom range with DATEADD function and relative start date', () => {
  const timeRangeFilter = {
    comparator: 'now : DATEADD(DATETIME("2024-06-03T00:00:00"), 7, day)',
  };
  const shifts = ['custom'];
  const startDate = '2024-06-01';
  jest.useFakeTimers();
  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['2 days ago'],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, [
    '2 days ago',
  ]);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['2 days ago'],
  );
});

test('should handle custom range with DATEADD function and relative end date', () => {
  const timeRangeFilter = {
    comparator: 'DATEADD(DATETIME("now"), -7, day) : now',
  };
  const shifts = ['custom'];
  const startDate = '2024-05-23';
  jest.useFakeTimers();

  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['4 days ago'],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, [
    '4 days ago',
  ]);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['4 days ago'],
  );
});

test('should handle custom range with specific date and relative end date', () => {
  const timeRangeFilter = {
    comparator: '2024-06-01T00:00:00 : now',
  };
  const shifts = ['custom'];
  const startDate = '2024-05-23';
  jest.useFakeTimers();

  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['9 days ago'],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, [
    '9 days ago',
  ]);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['9 days ago'],
  );
});

test('should handle custom range with specific date and specific end date', () => {
  const timeRangeFilter = {
    comparator: 'now : 2024-06-10T00:00:00',
  };
  const shifts = ['custom'];
  const startDate = '2024-06-01';
  jest.useFakeTimers();
  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['2 days ago'],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, [
    '2 days ago',
  ]);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['2 days ago'],
  );
});

test('should handle custom range with Last and now', () => {
  const timeRangeFilter = {
    comparator: 'Last day : now',
  };
  const shifts = ['custom'];
  const startDate = '2024-05-30';
  jest.useFakeTimers();
  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['3 days ago'],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, [
    '3 days ago',
  ]);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['3 days ago'],
  );
});

test('should handle custom range with Last week', () => {
  const timeRangeFilter = {
    comparator: 'Last week',
  };
  const shifts = ['custom'];
  const startDate = '2024-05-21';
  jest.useFakeTimers();
  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['6 days ago'],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, [
    '6 days ago',
  ]);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['6 days ago'],
  );
});

test('should handle custom range with previous calendar week', () => {
  const timeRangeFilter = {
    comparator: 'previous calendar week',
  };
  const shifts = ['custom'];
  const startDate = '2024-05-26';
  jest.useFakeTimers();
  runTimezoneTest(
    '2024-06-05T02:06:00+02:00',
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['1 days ago'],
  );
  runTimezoneTest(
    '2024-06-05T00:06:00Z',
    'UTC',
    timeRangeFilter,
    shifts,
    startDate,
    ['1 days ago'],
  );
  runTimezoneTest(
    '2024-06-04T16:06:00-08:00',
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['1 days ago'],
  );
});

test('should handle custom range with previous calendar month', () => {
  const timeRangeFilter = {
    comparator: 'previous calendar month',
  };
  const shifts = ['custom'];
  const startDate = '2024-04-26';
  jest.useFakeTimers();
  runTimezoneTest(
    '2024-06-05T02:06:00+02:00',
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['5 days ago'],
  );
  runTimezoneTest(
    '2024-06-05T00:06:00Z',
    'UTC',
    timeRangeFilter,
    shifts,
    startDate,
    ['5 days ago'],
  );
  runTimezoneTest(
    '2024-06-04T16:06:00-08:00',
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['5 days ago'],
  );
});

test('should handle custom range with previous calendar year', () => {
  const timeRangeFilter = {
    comparator: 'previous calendar year',
  };
  const shifts = ['custom'];
  const startDate = '2022-12-26';
  jest.useFakeTimers();

  runTimezoneTest(
    '2024-06-05T02:06:00+02:00',
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['6 days ago'],
  );
  runTimezoneTest(
    '2024-06-05T00:06:00Z',
    'UTC',
    timeRangeFilter,
    shifts,
    startDate,
    ['6 days ago'],
  );
  runTimezoneTest(
    '2024-06-04T16:06:00-08:00',
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['6 days ago'],
  );
});

test('should handle custom range with Advanced 2022-11-01', () => {
  const timeRangeFilter = {
    comparator: '2022-11-01 : 2022-11-15',
  };
  const shifts = ['custom'];
  const startDate = '2022-10-18';
  jest.useFakeTimers();

  runTimezoneTest(
    '2024-06-05T02:06:00+02:00',
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['14 days ago'],
  );
  runTimezoneTest(
    '2024-06-05T00:06:00Z',
    'UTC',
    timeRangeFilter,
    shifts,
    startDate,
    ['14 days ago'],
  );
  runTimezoneTest(
    '2024-06-04T16:06:00-08:00',
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['14 days ago'],
  );
});

test('should handle future inherit shift with includeFutureOffsets set to true', () => {
  const timeRangeFilter = {
    comparator: '2024-06-10 : 2024-06-05',
  };
  const shifts = ['inherit'];
  const startDate = '2024-06-20';
  jest.useFakeTimers();

  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['5 days after'],
    undefined,
  );
  runTimezoneTest(
    NOW_IN_UTC,
    'UTC',
    timeRangeFilter,
    shifts,
    startDate,
    ['5 days after'],
    undefined,
  );
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['5 days after'],
    undefined,
  );
});

test('should handle future custom shift with includeFutureOffsets set to true', () => {
  const timeRangeFilter = {
    comparator: '2024-06-10 : 2024-06-05',
  };
  const shifts = ['custom'];
  const startDate = '2024-06-15';
  jest.useFakeTimers();

  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['5 days after'],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, [
    '5 days after',
  ]);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['5 days after'],
  );
});

test('should handle custom range with specific (YYYY-MM) and relative dates', () => {
  const timeRangeFilter = {
    comparator: '2024-06 : DATEADD(DATETIME("2024-06-03T00:00:00"), 7, day)',
  };
  const shifts = ['custom'];
  const startDate = '2024-05-29';
  jest.useFakeTimers();

  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['3 days ago'],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, [
    '3 days ago',
  ]);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['2 days ago'],
  );
});

test('should handle custom range with minutes', () => {
  const timeRangeFilter = {
    comparator: '10 minutes ago : now',
  };
  const shifts = ['custom'];
  const startDate = '2024-05-29';
  jest.useFakeTimers();

  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['5 days ago'],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, [
    '5 days ago',
  ]);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['5 days ago'],
  );
});

test('should handle custom range with undefined startDate', () => {
  const timeRangeFilter = {
    comparator: '',
  };
  const shifts = ['custom'];
  const startDate = undefined;
  jest.useFakeTimers();

  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    [],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, []);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    [],
  );
});

test('should handle future custom shift with different format', () => {
  const timeRangeFilter = {
    comparator: '2024-06-10T23:45:30-05:00 : 2024-06-05',
  };
  const shifts = ['custom'];
  const startDate = '2024-06-15';
  jest.useFakeTimers();

  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['4 days after'],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, [
    '4 days after',
  ]);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['5 days after'],
  );
});

test('should handle custom range with relative dates', () => {
  const timeRangeFilter = {
    comparator:
      'DATEADD(DATETIME("now"), -7, day) : DATEADD(DATETIME("now"), 7, day)',
  };
  const shifts = ['custom'];
  const startDate = '2024-05-29';
  jest.useFakeTimers();

  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['2 days after'],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, [
    '2 days after',
  ]);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['2 days after'],
  );
});

test('should handle custom range with relative dates (minute and seconds)', () => {
  const timeRangeFilter = {
    comparator:
      'DATEADD(DATETIME("now"), -700, minute) : DATEADD(DATETIME("now"), 7000, second)',
  };
  const shifts = ['custom'];
  const startDate = '2024-05-29';
  jest.useFakeTimers();

  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['4 days ago'],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, [
    '4 days ago',
  ]);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['4 days ago'],
  );
});

test('should handle custom range with relative dates (hour)', () => {
  const timeRangeFilter = {
    comparator:
      'DATEADD(DATETIME("now"), -24, hour) : DATEADD(DATETIME("now"), 24, hour)',
  };
  const shifts = ['custom'];
  const startDate = '2024-05-29';
  jest.useFakeTimers();

  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['4 days ago'],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, [
    '4 days ago',
  ]);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['4 days ago'],
  );
});

test('should handle custom shifts with same day', () => {
  const timeRangeFilter = {
    comparator: '2024-05-29 : 2024-05-29',
  };
  const shifts = ['custom'];
  const startDate = '2024-05-29';
  jest.useFakeTimers();

  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    ['0 days ago'],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, [
    '0 days ago',
  ]);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    ['0 days ago'],
  );
});

test('should handle inherit shifts without filter', () => {
  const timeRangeFilter = {
    comparator: ':',
  };
  const shifts = ['inherit'];
  const startDate = '2024-05-29';
  jest.useFakeTimers();

  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    [],
  );
  runTimezoneTest(NOW_IN_UTC, 'UTC', timeRangeFilter, shifts, startDate, []);
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    [],
  );
});

test('should handle inherit shift same day', () => {
  const timeRangeFilter = {
    comparator: '2024-03-06 : 2024-03-06',
  };
  const shifts = ['inherit'];
  const startDate = '2024-03-06';
  jest.useFakeTimers();
  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    [],
    true,
  );
  runTimezoneTest(
    NOW_IN_UTC,
    'UTC',
    timeRangeFilter,
    shifts,
    startDate,
    [],
    true,
  );
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    [],
    true,
  );
});

test('should handle inherit shift same day includeFutureOffsets set to false', () => {
  const timeRangeFilter = {
    comparator: '2024-03-06 : 2024-03-01',
  };
  const shifts = ['inherit'];
  const startDate = '2024-03-06';
  jest.useFakeTimers();
  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    [],
    false,
  );
  runTimezoneTest(
    NOW_IN_UTC,
    'UTC',
    timeRangeFilter,
    shifts,
    startDate,
    [],
    false,
  );
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    [],
    false,
  );
});

test('should handle custom shift same day includeFutureOffsets set to false', () => {
  const timeRangeFilter = {
    comparator: '2024-03-01 : 2024-03-01',
  };
  const shifts = ['custom'];
  const startDate = '2024-03-06';
  jest.useFakeTimers();
  runTimezoneTest(
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    timeRangeFilter,
    shifts,
    startDate,
    [],
    false,
  );
  runTimezoneTest(
    NOW_IN_UTC,
    'UTC',
    timeRangeFilter,
    shifts,
    startDate,
    [],
    false,
  );
  runTimezoneTest(
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    timeRangeFilter,
    shifts,
    startDate,
    [],
    false,
  );
});
