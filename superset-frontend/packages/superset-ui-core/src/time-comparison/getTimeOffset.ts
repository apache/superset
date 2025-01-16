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
import { isEmpty } from 'lodash';
import { ensureIsArray } from '../utils';
import { customTimeRangeDecode } from './customTimeRangeDecode';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const parseDttmToDate = (
  dttm: string,
  isEndDate = false,
  computingShifts = false,
) => {
  const now = new Date();
  if (dttm === 'now' || dttm === 'No filter' || dttm === '') {
    return now;
  }

  if (dttm === 'today') {
    now.setHours(0, 0, 0, 0);
    return now;
  }

  if (computingShifts) {
    now.setHours(-now.getTimezoneOffset() / 60, 0, 0, 0);
  } else {
    now.setHours(0, 0, 0, 0);
  }

  if (isEndDate && dttm?.includes('Last')) {
    return now;
  }

  switch (dttm) {
    case 'Last day':
      now.setUTCDate(now.getUTCDate() - 1);
      return now;
    case 'Last week':
      now.setUTCDate(now.getUTCDate() - 7);
      return now;
    case 'Last month':
      now.setUTCMonth(now.getUTCMonth() - 1);
      return now;
    case 'Last quarter':
      now.setUTCMonth(now.getUTCMonth() - 3);
      return now;
    case 'Last year':
      now.setUTCFullYear(now.getUTCFullYear() - 1);
      return now;
    case 'previous calendar week':
      if (isEndDate) {
        now.setDate(now.getDate() - now.getDay() + 1); // end date is the last day of the previous week (Sunday)
      } else {
        now.setDate(now.getDate() - now.getDay() - 6); // start date is the first day of the previous week (Monday)
      }
      return now;
    case 'previous calendar month':
      if (isEndDate) {
        now.setDate(1); // end date is the last day of the previous month
      } else {
        now.setDate(1); // start date is the first day of the previous month
        now.setMonth(now.getMonth() - 1);
      }
      return now;
    case 'previous calendar year':
      if (isEndDate) {
        now.setFullYear(now.getFullYear(), 0, 1); // end date is the last day of the previous year
      } else {
        now.setFullYear(now.getFullYear() - 1, 0, 1); // start date is the first day of the previous year
      }
      return now;
    default:
      break;
  }
  if (dttm?.includes('ago')) {
    const parts = dttm.split(' ');
    const amount = parseInt(parts[0], 10);
    const unit = parts[1];
    switch (unit) {
      case 'day':
      case 'days':
        now.setUTCDate(now.getUTCDate() - amount);
        break;
      case 'week':
      case 'weeks':
        now.setUTCDate(now.getUTCDate() - amount * 7);
        break;
      case 'month':
      case 'months':
        now.setUTCMonth(now.getUTCMonth() - amount);
        break;
      case 'year':
      case 'years':
        now.setUTCFullYear(now.getUTCFullYear() - amount);
        break;
      default:
        break;
    }
    return now;
  }
  const parts = dttm?.split('-');
  let parsed: Date | null = null;
  if (parts && !isEmpty(parts)) {
    if (parts.length === 1) {
      parsed = new Date(Date.UTC(parseInt(parts[0], 10), 0));
    } else if (parts.length === 2) {
      parsed = new Date(
        Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1),
      );
    } else if (parts.length === 3) {
      parsed = new Date(
        parseInt(parts[0], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2], 10),
      );
    } else {
      parsed = new Date(dttm);
    }
  } else {
    parsed = new Date(dttm);
  }
  if (parsed && !Number.isNaN(parsed.getTime())) {
    if (computingShifts) {
      parsed.setHours(-parsed.getTimezoneOffset() / 60, 0, 0, 0);
    } else {
      parsed.setHours(0, 0, 0, 0);
    }
    return parsed;
  }
  // Return null if the string cannot be parsed into a date
  return null;
};

export const computeCustomDateTime = (
  dttm: string,
  grain: string,
  grainValue: number,
) => {
  let parsed: Date;
  if (dttm === 'now' || dttm === 'today') {
    parsed = new Date();
  } else {
    parsed = new Date(dttm);
  }
  if (!Number.isNaN(parsed.getTime())) {
    switch (grain) {
      case 'second':
        parsed.setSeconds(parsed.getSeconds() + grainValue);
        break;
      case 'minute':
        parsed.setMinutes(parsed.getMinutes() + grainValue);
        break;
      case 'hour':
        parsed.setHours(parsed.getHours() + grainValue);
        break;
      case 'day':
        parsed.setDate(parsed.getDate() + grainValue);
        break;
      case 'week':
        parsed.setDate(parsed.getDate() + grainValue * 7);
        break;
      case 'month':
        parsed.setMonth(parsed.getMonth() + grainValue);
        break;
      case 'quarter':
        parsed.setMonth(parsed.getMonth() + grainValue * 3);
        break;
      case 'year':
        parsed.setFullYear(parsed.getFullYear() + grainValue);
        break;
      default:
        break;
    }
    return parsed;
  }
  return null;
};

type TimeOffsetArgs = {
  timeRangeFilter: any;
  shifts: string[];
  startDate: string;
  includeFutureOffsets?: boolean;
};

export const getTimeOffset = ({
  timeRangeFilter,
  shifts,
  startDate,
  includeFutureOffsets = true,
}: TimeOffsetArgs): string[] => {
  const { customRange, matchedFlag } = customTimeRangeDecode(
    timeRangeFilter?.comparator ?? '',
  );
  let customStartDate: Date | null = null;
  let customEndDate: Date | null = null;
  if (matchedFlag) {
    // Compute the start date and end date using the custom range information
    const {
      sinceDatetime,
      sinceMode,
      sinceGrain,
      sinceGrainValue,
      untilDatetime,
      untilMode,
      untilGrain,
      untilGrainValue,
    } = { ...customRange };
    if (sinceMode !== 'relative') {
      if (sinceMode === 'specific') {
        customStartDate = new Date(sinceDatetime);
      } else {
        customStartDate = parseDttmToDate(sinceDatetime, false, true);
      }
    } else {
      customStartDate = computeCustomDateTime(
        sinceDatetime,
        sinceGrain,
        sinceGrainValue,
      );
    }
    customStartDate?.setHours(0, 0, 0, 0);
    if (untilMode !== 'relative') {
      if (untilMode === 'specific') {
        customEndDate = new Date(untilDatetime);
      } else {
        customEndDate = parseDttmToDate(untilDatetime, false, true);
      }
    } else {
      customEndDate = computeCustomDateTime(
        untilDatetime,
        untilGrain,
        untilGrainValue,
      );
    }
    customEndDate?.setHours(0, 0, 0, 0);
  }
  const isCustom = shifts?.includes('custom');
  const isInherit = shifts?.includes('inherit');
  let customStartDateTime: number | undefined;
  if (isCustom) {
    if (matchedFlag) {
      customStartDateTime = new Date(
        new Date(startDate).setUTCHours(
          new Date(startDate).getTimezoneOffset() / 60,
          0,
          0,
          0,
        ),
      ).getTime();
    } else {
      customStartDateTime = parseDttmToDate(startDate)?.getTime();
    }
  }
  const [startStr, endStr] = (timeRangeFilter?.comparator ?? '')
    .split(' : ')
    .map((date: string) => date.trim());
  const filterStartDateTime =
    (customStartDate ?? parseDttmToDate(startStr, false, false))?.getTime() ||
    0;
  const filterEndDateTime =
    (
      customEndDate ?? parseDttmToDate(endStr || startStr, true, false)
    )?.getTime() || 0;

  const customShift =
    customStartDateTime &&
    filterStartDateTime &&
    Math.round((filterStartDateTime - customStartDateTime) / DAY_IN_MS);
  const inInheritShift =
    isInherit &&
    filterEndDateTime &&
    filterStartDateTime &&
    Math.round((filterEndDateTime - filterStartDateTime) / DAY_IN_MS);

  const newShifts = ensureIsArray(shifts)
    .map(shift => {
      if (shift === 'custom') {
        if (customShift !== undefined && !Number.isNaN(customShift)) {
          if (includeFutureOffsets && customShift < 0) {
            return `${customShift * -1} days after`;
          }
          if (customShift >= 0 && filterStartDateTime) {
            return `${customShift} days ago`;
          }
        }
      }
      if (shift === 'inherit') {
        if (inInheritShift && !Number.isNaN(inInheritShift)) {
          if (includeFutureOffsets && inInheritShift < 0) {
            return `${inInheritShift * -1} days after`;
          }
          if (inInheritShift > 0) {
            return `${inInheritShift} days ago`;
          }
        }
      }
      return shift;
    })
    .filter(shift => shift !== 'custom' && shift !== 'inherit');
  return ensureIsArray(newShifts);
};
