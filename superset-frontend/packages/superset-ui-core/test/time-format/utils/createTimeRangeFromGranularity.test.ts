import createTimeRangeFromGranularity from '@superset-ui/core/src/time-format/utils/createTimeRangeFromGranularity';
import {
  TimeGranularity,
  getTimeRangeFormatter,
  LOCAL_PREFIX,
} from '@superset-ui/core/src/time-format';

const formatString = '%Y-%m-%d %H:%M:%S.%L';
const formatUTCTimeRange = getTimeRangeFormatter(formatString);
const formatLocalTimeRange = getTimeRangeFormatter(`${LOCAL_PREFIX}${formatString}`);

function testUTC(
  granularity: TimeGranularity,
  year: number,
  month = 0,
  date = 1,
  hours = 0,
  minutes = 0,
  seconds = 0,
) {
  return formatUTCTimeRange(
    createTimeRangeFromGranularity(
      new Date(Date.UTC(year, month, date, hours, minutes, seconds)),
      granularity,
    ),
  );
}

function testLocal(
  granularity: TimeGranularity,
  year: number,
  month = 0,
  date = 1,
  hours = 0,
  minutes = 0,
  seconds = 0,
) {
  return formatLocalTimeRange(
    createTimeRangeFromGranularity(
      new Date(year, month, date, hours, minutes, seconds),
      granularity,
      true,
    ),
  );
}

describe('createTimeRangeFromGranularity(time, granularity, useLocalTime)', () => {
  describe('UTC time', () => {
    it('creates time range according to specified granularity', () => {
      expect(testUTC(TimeGranularity.DATE, 2020, 4, 15)).toEqual(
        '2020-05-15 00:00:00.000 — 2020-05-15 23:59:59.999',
      );
      expect(testUTC(TimeGranularity.SECOND, 2020, 4, 15)).toEqual(
        '2020-05-15 00:00:00.000 — 2020-05-15 00:00:00.999',
      );
      expect(testUTC(TimeGranularity.MINUTE, 2020, 4, 15)).toEqual(
        '2020-05-15 00:00:00.000 — 2020-05-15 00:00:59.999',
      );
      expect(testUTC(TimeGranularity.FIVE_MINUTES, 2020, 4, 15)).toEqual(
        '2020-05-15 00:00:00.000 — 2020-05-15 00:04:59.999',
      );
      expect(testUTC(TimeGranularity.TEN_MINUTES, 2020, 4, 15)).toEqual(
        '2020-05-15 00:00:00.000 — 2020-05-15 00:09:59.999',
      );
      expect(testUTC(TimeGranularity.FIFTEEN_MINUTES, 2020, 4, 15)).toEqual(
        '2020-05-15 00:00:00.000 — 2020-05-15 00:14:59.999',
      );
      expect(testUTC(TimeGranularity.HALF_HOUR, 2020, 4, 15)).toEqual(
        '2020-05-15 00:00:00.000 — 2020-05-15 00:29:59.999',
      );
      expect(testUTC(TimeGranularity.HOUR, 2020, 4, 15)).toEqual(
        '2020-05-15 00:00:00.000 — 2020-05-15 00:59:59.999',
      );
      expect(testUTC(TimeGranularity.DAY, 2020, 4, 15)).toEqual(
        '2020-05-15 00:00:00.000 — 2020-05-15 23:59:59.999',
      );
      expect(testUTC(TimeGranularity.WEEK, 2020, 4, 15)).toEqual(
        '2020-05-15 00:00:00.000 — 2020-05-21 23:59:59.999',
      );
      expect(testUTC(TimeGranularity.WEEK_STARTING_SUNDAY, 2020, 4, 17)).toEqual(
        '2020-05-17 00:00:00.000 — 2020-05-23 23:59:59.999',
      );
      expect(testUTC(TimeGranularity.WEEK_STARTING_MONDAY, 2020, 4, 18)).toEqual(
        '2020-05-18 00:00:00.000 — 2020-05-24 23:59:59.999',
      );
      expect(testUTC(TimeGranularity.WEEK_ENDING_SATURDAY, 2020, 4, 16)).toEqual(
        '2020-05-10 00:00:00.000 — 2020-05-16 23:59:59.999',
      );
      expect(testUTC(TimeGranularity.WEEK_ENDING_SUNDAY, 2020, 4, 17)).toEqual(
        '2020-05-11 00:00:00.000 — 2020-05-17 23:59:59.999',
      );
      expect(testUTC(TimeGranularity.MONTH, 2020, 4, 1)).toEqual(
        '2020-05-01 00:00:00.000 — 2020-05-31 23:59:59.999',
      );
      expect(testUTC(TimeGranularity.MONTH, 2020, 11, 1)).toEqual(
        '2020-12-01 00:00:00.000 — 2020-12-31 23:59:59.999',
      );
      expect(testUTC(TimeGranularity.QUARTER, 2020, 3, 1)).toEqual(
        '2020-04-01 00:00:00.000 — 2020-06-30 23:59:59.999',
      );
      expect(testUTC(TimeGranularity.QUARTER, 2020, 9, 1)).toEqual(
        '2020-10-01 00:00:00.000 — 2020-12-31 23:59:59.999',
      );
      expect(testUTC(TimeGranularity.YEAR, 2020, 0, 1)).toEqual(
        '2020-01-01 00:00:00.000 — 2020-12-31 23:59:59.999',
      );
    });
  });
  describe('Local time', () => {
    it('creates time range according to specified granularity', () => {
      expect(testLocal(TimeGranularity.DATE, 2020, 4, 15)).toEqual(
        '2020-05-15 00:00:00.000 — 2020-05-15 23:59:59.999',
      );
      expect(testLocal(TimeGranularity.SECOND, 2020, 4, 15)).toEqual(
        '2020-05-15 00:00:00.000 — 2020-05-15 00:00:00.999',
      );
      expect(testLocal(TimeGranularity.MINUTE, 2020, 4, 15)).toEqual(
        '2020-05-15 00:00:00.000 — 2020-05-15 00:00:59.999',
      );
      expect(testLocal(TimeGranularity.FIVE_MINUTES, 2020, 4, 15)).toEqual(
        '2020-05-15 00:00:00.000 — 2020-05-15 00:04:59.999',
      );
      expect(testLocal(TimeGranularity.TEN_MINUTES, 2020, 4, 15)).toEqual(
        '2020-05-15 00:00:00.000 — 2020-05-15 00:09:59.999',
      );
      expect(testLocal(TimeGranularity.FIFTEEN_MINUTES, 2020, 4, 15)).toEqual(
        '2020-05-15 00:00:00.000 — 2020-05-15 00:14:59.999',
      );
      expect(testLocal(TimeGranularity.HALF_HOUR, 2020, 4, 15)).toEqual(
        '2020-05-15 00:00:00.000 — 2020-05-15 00:29:59.999',
      );
      expect(testLocal(TimeGranularity.HOUR, 2020, 4, 15)).toEqual(
        '2020-05-15 00:00:00.000 — 2020-05-15 00:59:59.999',
      );
      expect(testLocal(TimeGranularity.DAY, 2020, 4, 15)).toEqual(
        '2020-05-15 00:00:00.000 — 2020-05-15 23:59:59.999',
      );
      expect(testLocal(TimeGranularity.WEEK, 2020, 4, 15)).toEqual(
        '2020-05-15 00:00:00.000 — 2020-05-21 23:59:59.999',
      );
      expect(testLocal(TimeGranularity.WEEK_STARTING_SUNDAY, 2020, 4, 17)).toEqual(
        '2020-05-17 00:00:00.000 — 2020-05-23 23:59:59.999',
      );
      expect(testLocal(TimeGranularity.WEEK_STARTING_MONDAY, 2020, 4, 18)).toEqual(
        '2020-05-18 00:00:00.000 — 2020-05-24 23:59:59.999',
      );
      expect(testLocal(TimeGranularity.WEEK_ENDING_SATURDAY, 2020, 4, 16)).toEqual(
        '2020-05-10 00:00:00.000 — 2020-05-16 23:59:59.999',
      );
      expect(testLocal(TimeGranularity.WEEK_ENDING_SUNDAY, 2020, 4, 17)).toEqual(
        '2020-05-11 00:00:00.000 — 2020-05-17 23:59:59.999',
      );
      expect(testLocal(TimeGranularity.MONTH, 2020, 4, 1)).toEqual(
        '2020-05-01 00:00:00.000 — 2020-05-31 23:59:59.999',
      );
      expect(testLocal(TimeGranularity.MONTH, 2020, 11, 1)).toEqual(
        '2020-12-01 00:00:00.000 — 2020-12-31 23:59:59.999',
      );
      expect(testLocal(TimeGranularity.QUARTER, 2020, 3, 1)).toEqual(
        '2020-04-01 00:00:00.000 — 2020-06-30 23:59:59.999',
      );
      expect(testLocal(TimeGranularity.QUARTER, 2020, 9, 1)).toEqual(
        '2020-10-01 00:00:00.000 — 2020-12-31 23:59:59.999',
      );
      expect(testLocal(TimeGranularity.YEAR, 2020, 0, 1)).toEqual(
        '2020-01-01 00:00:00.000 — 2020-12-31 23:59:59.999',
      );
    });
  });
});
