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

import { customTimeRangeEncode } from 'src/explore/components/controls/DateFilterControl/utils';

describe('Custom TimeRange', () => {
  describe('customTimeRangeEncode', () => {
    it('1) specific : specific', () => {
      expect(
        customTimeRangeEncode({
          sinceDatetime: '2021-01-20T00:00:00',
          sinceMode: 'specific',
          sinceGrain: 'day',
          sinceGrainValue: -7,
          untilDatetime: '2021-01-27T00:00:00',
          untilMode: 'specific',
          untilGrain: 'day',
          untilGrainValue: 7,
          anchorMode: 'now',
          anchorValue: 'now',
        }),
      ).toEqual('2021-01-20T00:00:00 : 2021-01-27T00:00:00');
    });

    it('2) specific : relative', () => {
      expect(
        customTimeRangeEncode({
          sinceDatetime: '2021-01-20T00:00:00',
          sinceMode: 'specific',
          sinceGrain: 'day',
          sinceGrainValue: -7,
          untilDatetime: '2021-01-20T00:00:00',
          untilMode: 'relative',
          untilGrain: 'day',
          untilGrainValue: 7,
          anchorMode: 'now',
          anchorValue: 'now',
        }),
      ).toEqual(
        '2021-01-20T00:00:00 : DATEADD(DATETIME("2021-01-20T00:00:00"), 7, day)',
      );
    });

    it('3) now : relative', () => {
      expect(
        customTimeRangeEncode({
          sinceDatetime: 'now',
          sinceMode: 'now',
          sinceGrain: 'day',
          sinceGrainValue: -7,
          untilDatetime: 'now',
          untilMode: 'relative',
          untilGrain: 'day',
          untilGrainValue: 7,
          anchorMode: 'now',
          anchorValue: 'now',
        }),
      ).toEqual('now : DATEADD(DATETIME("now"), 7, day)');
    });

    it('4) today : relative', () => {
      expect(
        customTimeRangeEncode({
          sinceDatetime: 'today',
          sinceMode: 'today',
          sinceGrain: 'day',
          sinceGrainValue: -7,
          untilDatetime: 'today',
          untilMode: 'relative',
          untilGrain: 'day',
          untilGrainValue: 7,
          anchorMode: 'now',
          anchorValue: 'now',
        }),
      ).toEqual('today : DATEADD(DATETIME("today"), 7, day)');
    });

    it('5) relative : specific', () => {
      expect(
        customTimeRangeEncode({
          sinceDatetime: '2021-01-27T00:00:00',
          sinceMode: 'relative',
          sinceGrain: 'day',
          sinceGrainValue: -7,
          untilDatetime: '2021-01-27T00:00:00',
          untilMode: 'specific',
          untilGrain: 'day',
          untilGrainValue: 7,
          anchorMode: 'now',
          anchorValue: 'now',
        }),
      ).toEqual(
        'DATEADD(DATETIME("2021-01-27T00:00:00"), -7, day) : 2021-01-27T00:00:00',
      );
    });

    it('6) relative : now', () => {
      expect(
        customTimeRangeEncode({
          sinceDatetime: 'now',
          sinceMode: 'relative',
          sinceGrain: 'day',
          sinceGrainValue: -7,
          untilDatetime: 'now',
          untilMode: 'now',
          untilGrain: 'day',
          untilGrainValue: 7,
          anchorMode: 'now',
          anchorValue: 'now',
        }),
      ).toEqual('DATEADD(DATETIME("now"), -7, day) : now');
    });

    it('7) relative : today', () => {
      expect(
        customTimeRangeEncode({
          sinceDatetime: 'today',
          sinceMode: 'relative',
          sinceGrain: 'day',
          sinceGrainValue: -7,
          untilDatetime: 'today',
          untilMode: 'today',
          untilGrain: 'day',
          untilGrainValue: 7,
          anchorMode: 'now',
          anchorValue: 'now',
        }),
      ).toEqual('DATEADD(DATETIME("today"), -7, day) : today');
    });

    it('8) relative : relative (now)', () => {
      expect(
        customTimeRangeEncode({
          sinceDatetime: 'now',
          sinceMode: 'relative',
          sinceGrain: 'day',
          sinceGrainValue: -7,
          untilDatetime: 'now',
          untilMode: 'relative',
          untilGrain: 'day',
          untilGrainValue: 7,
          anchorMode: 'now',
          anchorValue: 'now',
        }),
      ).toEqual(
        'DATEADD(DATETIME("now"), -7, day) : DATEADD(DATETIME("now"), 7, day)',
      );
    });

    it('9) relative : relative (date/time)', () => {
      expect(
        customTimeRangeEncode({
          sinceDatetime: '2021-01-27T00:00:00',
          sinceMode: 'relative',
          sinceGrain: 'day',
          sinceGrainValue: -7,
          untilDatetime: '2021-01-27T00:00:00',
          untilMode: 'relative',
          untilGrain: 'day',
          untilGrainValue: 7,
          anchorMode: 'specific',
          anchorValue: '2021-01-27T00:00:00',
        }),
      ).toEqual(
        'DATEADD(DATETIME("2021-01-27T00:00:00"), -7, day) : DATEADD(DATETIME("2021-01-27T00:00:00"), 7, day)',
      );
    });
  });
});
