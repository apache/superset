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
) => {
  jest.setSystemTime(new Date(now_time));
  timezoneMock.register(timezone);
  const result = getTimeOffset({ timeRangeFilter, shifts, startDate });
  expect(result).toEqual(expected_result);
  timezoneMock.unregister();
};

test('should handle custom range with specific dates', () => {
  const timeRangeFilter = {
    comparator: '2024-06-03 : 2024-06-10',
  };
  const shifts = ['custom'];
  const startDate = '2024-05-29';
  jest.useFakeTimers('modern');

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

test('should handle custom range with relative dates', () => {
  const timeRangeFilter = {
    comparator: 'now : 2024-06-10',
  };
  const shifts = ['custom'];
  const startDate = '2024-05-30';
  jest.useFakeTimers('modern');

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
  jest.useFakeTimers('modern');
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
  jest.useFakeTimers('modern');
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
  jest.useFakeTimers('modern');
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
  jest.useFakeTimers('modern');
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
  jest.useFakeTimers('modern');

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
  jest.useFakeTimers('modern');
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
  jest.useFakeTimers('modern');
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
  jest.useFakeTimers('modern');

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
  jest.useFakeTimers('modern');

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
  jest.useFakeTimers('modern');
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
  jest.useFakeTimers('modern');
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
  jest.useFakeTimers('modern');
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
  jest.useFakeTimers('modern');
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
  jest.useFakeTimers('modern');
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
  jest.useFakeTimers('modern');

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
  jest.useFakeTimers('modern');

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
