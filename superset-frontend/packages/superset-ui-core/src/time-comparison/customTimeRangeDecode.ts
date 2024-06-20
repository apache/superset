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

import { SEPARATOR } from './fetchTimeRange';
import {
  CustomRangeDecodeType,
  CustomRangeType,
  DateTimeGrainType,
  DateTimeModeType,
} from './types';

const iso8601 = String.raw`\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:(?:[+-]\d\d:\d\d)|Z)?`;
const datetimeConstant = String.raw`(?:TODAY|NOW)`;
const grainValue = String.raw`[+-]?[1-9][0-9]*`;
const grain = String.raw`YEAR|QUARTER|MONTH|WEEK|DAY|HOUR|MINUTE|SECOND`;
const CUSTOM_RANGE_EXPRESSION = RegExp(
  String.raw`^DATEADD\(DATETIME\("(${iso8601}|${datetimeConstant})"\),\s(${grainValue}),\s(${grain})\)$`,
  'i',
);
export const ISO8601_AND_CONSTANT = RegExp(
  String.raw`^${iso8601}$|^${datetimeConstant}$`,
  'i',
);
const DATETIME_CONSTANT = ['now', 'today'];
const SEVEN_DAYS_AGO = new Date();
SEVEN_DAYS_AGO.setUTCHours(0, 0, 0, 0);

const MIDNIGHT = new Date();
MIDNIGHT.setUTCHours(0, 0, 0, 0);

const defaultCustomRange: CustomRangeType = {
  sinceDatetime: SEVEN_DAYS_AGO.setUTCDate(
    SEVEN_DAYS_AGO.getUTCDate() - 7,
  ).toString(),
  sinceMode: 'relative',
  sinceGrain: 'day',
  sinceGrainValue: -7,
  untilDatetime: MIDNIGHT.toString(),
  untilMode: 'specific',
  untilGrain: 'day',
  untilGrainValue: 7,
  anchorMode: 'now',
  anchorValue: 'now',
};

export const customTimeRangeDecode = (
  timeRange: string,
): CustomRangeDecodeType => {
  const splitDateRange = timeRange.split(SEPARATOR);

  if (splitDateRange.length === 2) {
    const [since, until] = splitDateRange;

    // specific : specific
    if (ISO8601_AND_CONSTANT.test(since) && ISO8601_AND_CONSTANT.test(until)) {
      const sinceMode = (
        DATETIME_CONSTANT.includes(since) ? since : 'specific'
      ) as DateTimeModeType;
      const untilMode = (
        DATETIME_CONSTANT.includes(until) ? until : 'specific'
      ) as DateTimeModeType;
      return {
        customRange: {
          ...defaultCustomRange,
          sinceDatetime: since,
          untilDatetime: until,
          sinceMode,
          untilMode,
        },
        matchedFlag: true,
      };
    }

    // relative : specific
    const sinceCapturedGroup = since.match(CUSTOM_RANGE_EXPRESSION);
    if (
      sinceCapturedGroup &&
      ISO8601_AND_CONSTANT.test(until) &&
      since.includes(until)
    ) {
      const [dttm, grainValue, grain] = sinceCapturedGroup.slice(1);
      const untilMode = (
        DATETIME_CONSTANT.includes(until) ? until : 'specific'
      ) as DateTimeModeType;
      return {
        customRange: {
          ...defaultCustomRange,
          sinceGrain: grain as DateTimeGrainType,
          sinceGrainValue: parseInt(grainValue, 10),
          sinceDatetime: dttm,
          untilDatetime: dttm,
          sinceMode: 'relative',
          untilMode,
        },
        matchedFlag: true,
      };
    }

    // specific : relative
    const untilCapturedGroup = until.match(CUSTOM_RANGE_EXPRESSION);
    if (
      ISO8601_AND_CONSTANT.test(since) &&
      untilCapturedGroup &&
      until.includes(since)
    ) {
      const [dttm, grainValue, grain] = [...untilCapturedGroup.slice(1)];
      const sinceMode = (
        DATETIME_CONSTANT.includes(since) ? since : 'specific'
      ) as DateTimeModeType;
      return {
        customRange: {
          ...defaultCustomRange,
          untilGrain: grain as DateTimeGrainType,
          untilGrainValue: parseInt(grainValue, 10),
          sinceDatetime: dttm,
          untilDatetime: dttm,
          untilMode: 'relative',
          sinceMode,
        },
        matchedFlag: true,
      };
    }

    // relative : relative
    if (sinceCapturedGroup && untilCapturedGroup) {
      const [sinceDttm, sinceGrainValue, sinceGrain] = [
        ...sinceCapturedGroup.slice(1),
      ];
      const [untilDttm, untilGrainValue, untilGrain] = [
        ...untilCapturedGroup.slice(1),
      ];
      if (sinceDttm === untilDttm) {
        return {
          customRange: {
            ...defaultCustomRange,
            sinceGrain: sinceGrain as DateTimeGrainType,
            sinceGrainValue: parseInt(sinceGrainValue, 10),
            sinceDatetime: sinceDttm,
            untilGrain: untilGrain as DateTimeGrainType,
            untilGrainValue: parseInt(untilGrainValue, 10),
            untilDatetime: untilDttm,
            anchorValue: sinceDttm,
            sinceMode: 'relative',
            untilMode: 'relative',
            anchorMode: sinceDttm === 'now' ? 'now' : 'specific',
          },
          matchedFlag: true,
        };
      }
    }
  }

  return {
    customRange: defaultCustomRange,
    matchedFlag: false,
  };
};
