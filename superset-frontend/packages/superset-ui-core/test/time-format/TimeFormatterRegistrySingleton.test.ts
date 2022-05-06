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
  TimeGranularity,
  LOCAL_PREFIX,
  PREVIEW_TIME,
  getTimeFormatter,
  formatTime,
  getTimeFormatterForGranularity,
  formatTimeRange,
  getTimeFormatterRegistry,
} from '@superset-ui/core';
import TimeFormatterRegistry from '../../src/time-format/TimeFormatterRegistry';

describe('TimeFormatterRegistrySingleton', () => {
  describe('getTimeFormatterRegistry()', () => {
    it('returns a TimeFormatterRegistry', () => {
      expect(getTimeFormatterRegistry()).toBeInstanceOf(TimeFormatterRegistry);
    });
  });
  describe('getTimeFormatter(format)', () => {
    it('returns a format function', () => {
      const format = getTimeFormatter('%d/%m/%Y');
      expect(format(PREVIEW_TIME)).toEqual('14/02/2017');
    });
    it('falls back to default format if format is not specified', () => {
      const format = getTimeFormatter();
      expect(format(PREVIEW_TIME)).toEqual('2017-02-14 11:22:33');
    });
    it(`use local time when format string has LOCAL_PREFIX (${LOCAL_PREFIX})`, () => {
      const format = getTimeFormatter('local!%m-%d %H:%M');
      expect(format(new Date(2019, 5, 18, 11, 23))).toEqual('06-18 11:23');
    });
  });
  describe('getTimeFormatterForGranularity(granularity?)', () => {
    it('returns the default formatter for that granularity', () => {
      const date = new Date(Date.UTC(2020, 4, 10)); // May 10, 2020 is Sunday
      expect(
        getTimeFormatterForGranularity(TimeGranularity.DATE)(date),
      ).toEqual('2020-05-10');
    });
  });
  describe('formatTimeRange(format?, values)', () => {
    it('format the given time range with specified format', () => {
      expect(
        formatTimeRange('%m-%d', [
          new Date(Date.UTC(2017, 1, 1)),
          new Date(Date.UTC(2017, 1, 2)),
        ]),
      ).toEqual('02-01 — 02-02');
    });
    it('show only one value if start and end are equal after formatting', () => {
      expect(
        formatTimeRange('%m-%d', [
          new Date(Date.UTC(2017, 1, 1)),
          new Date(Date.UTC(2017, 1, 1, 10)),
        ]),
      ).toEqual('02-01');
    });
    it('falls back to default format if format is not specified', () => {
      expect(
        formatTimeRange(undefined, [
          new Date(Date.UTC(2017, 1, 1)),
          new Date(Date.UTC(2017, 1, 2)),
        ]),
      ).toEqual('2017-02-01 00:00:00 — 2017-02-02 00:00:00');
    });
  });
  describe('formatTime(format?, value, granularity?)', () => {
    describe('without granularity', () => {
      it('format the given time using the specified format', () => {
        const output = formatTime('%Y-%m-%d', PREVIEW_TIME);
        expect(output).toEqual('2017-02-14');
      });
      it('falls back to the default formatter if the format is undefined', () => {
        expect(formatTime(undefined, PREVIEW_TIME)).toEqual(
          '2017-02-14 11:22:33',
        );
      });
    });
    describe('with granularity', () => {
      it('format the given time using specified format', () => {
        const output = formatTime(
          '%-m/%d',
          new Date(Date.UTC(2017, 4, 10)),
          TimeGranularity.WEEK,
        );
        expect(output).toEqual('5/10 — 5/16');
      });
      it('format the given time using default format if format is not specified', () => {
        const date = new Date(Date.UTC(2020, 4, 10)); // May 10, 2020 is Sunday
        expect(formatTime(undefined, date, TimeGranularity.DATE)).toEqual(
          '2020-05-10',
        );
        expect(formatTime(undefined, date, TimeGranularity.SECOND)).toEqual(
          '2020-05-10 00:00:00',
        );
        expect(formatTime(undefined, date, TimeGranularity.MINUTE)).toEqual(
          '2020-05-10 00:00',
        );
        expect(
          formatTime(undefined, date, TimeGranularity.FIVE_MINUTES),
        ).toEqual('2020-05-10 00:00 — 2020-05-10 00:04');
        expect(
          formatTime(undefined, date, TimeGranularity.TEN_MINUTES),
        ).toEqual('2020-05-10 00:00 — 2020-05-10 00:09');
        expect(
          formatTime(undefined, date, TimeGranularity.FIFTEEN_MINUTES),
        ).toEqual('2020-05-10 00:00 — 2020-05-10 00:14');
        expect(
          formatTime(undefined, date, TimeGranularity.THIRTY_MINUTES),
        ).toEqual('2020-05-10 00:00 — 2020-05-10 00:29');
        expect(formatTime(undefined, date, TimeGranularity.HOUR)).toEqual(
          '2020-05-10 00:00',
        );
        expect(formatTime(undefined, date, TimeGranularity.DAY)).toEqual(
          '2020-05-10',
        );
        expect(formatTime(undefined, date, TimeGranularity.WEEK)).toEqual(
          '2020-05-10 — 2020-05-16',
        );
        expect(
          formatTime(undefined, date, TimeGranularity.WEEK_STARTING_SUNDAY),
        ).toEqual('2020-05-10 — 2020-05-16');
        expect(
          formatTime(
            undefined,
            new Date(Date.UTC(2020, 4, 11)),
            TimeGranularity.WEEK_STARTING_MONDAY,
          ),
        ).toEqual('2020-05-11 — 2020-05-17');
        expect(
          formatTime(
            undefined,
            new Date(Date.UTC(2020, 4, 10)),
            TimeGranularity.WEEK_ENDING_SUNDAY,
          ),
        ).toEqual('2020-05-04 — 2020-05-10');
        expect(
          formatTime(
            undefined,
            new Date(Date.UTC(2020, 4, 9)),
            TimeGranularity.WEEK_ENDING_SATURDAY,
          ),
        ).toEqual('2020-05-03 — 2020-05-09');
        expect(
          formatTime(
            undefined,
            new Date(Date.UTC(2020, 3, 1)),
            TimeGranularity.MONTH,
          ),
        ).toEqual('Apr 2020');
        expect(
          formatTime(
            undefined,
            new Date(Date.UTC(2020, 3, 1)),
            TimeGranularity.QUARTER,
          ),
        ).toEqual('2020 Q2');
        expect(
          formatTime(
            undefined,
            new Date(Date.UTC(2020, 0, 1)),
            TimeGranularity.YEAR,
          ),
        ).toEqual('2020');
      });
    });
  });
});
