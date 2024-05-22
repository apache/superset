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
import { ensureIsArray } from '../utils';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
export const parseDttmToDate = (dttm: string): Date => {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);

  if (
    dttm === 'now' ||
    dttm === 'today' ||
    dttm === 'No filter' ||
    dttm === ''
  ) {
    return now;
  }
  if (dttm === 'Last day') {
    now.setUTCDate(now.getUTCDate() - 1);
    return now;
  }
  if (dttm === 'Last week') {
    now.setUTCDate(now.getUTCDate() - 7);
    return now;
  }
  if (dttm === 'Last month') {
    now.setUTCMonth(now.getUTCMonth() - 1);
    return now;
  }
  if (dttm === 'Last quarter') {
    now.setUTCMonth(now.getUTCMonth() - 3);
    return now;
  }
  if (dttm === 'Last year') {
    now.setUTCFullYear(now.getUTCFullYear() - 1);
    return now;
  }
  if (dttm === 'previous calendar week') {
    now.setUTCDate(now.getUTCDate() - now.getUTCDay());
    return now;
  }
  if (dttm === 'previous calendar month') {
    now.setUTCMonth(now.getUTCMonth() - 1, 1);
    return now;
  }
  if (dttm === 'previous calendar year') {
    now.setUTCFullYear(now.getUTCFullYear() - 1, 0, 1);
    return now;
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
  if (parts && parts.length > 1) {
    const parsed = new Date(
      Date.UTC(
        parseInt(parts[0], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2], 10),
      ),
    );
    parsed.setUTCHours(0, 0, 0, 0);
    return parsed;
  }
  const parsed = new Date(dttm);
  parsed.setUTCHours(0, 0, 0, 0);
  return parsed;
};

export const getTimeOffset = (
  timeRangeFilter: any,
  shifts: string[],
  startDate: string,
): string[] => {
  const isCustom = shifts?.includes('custom');
  const isInherit = shifts?.includes('inherit');
  const customStartDate = isCustom && parseDttmToDate(startDate).getTime();
  const [startStr, endStr] = (timeRangeFilter?.comparator ?? '')
    .split(' : ')
    .map((date: string) => date.trim());
  const filterStartDate = parseDttmToDate(startStr).getTime();
  let filterEndDate = parseDttmToDate(endStr).getTime();
  // Handle single relative date
  if (Number.isNaN(filterEndDate)) {
    const end = new Date();
    end.setUTCHours(0, 0, 0, 0);
    end.setUTCDate(end.getUTCDate());
    if (startStr === 'previous calendar week') {
      end.setUTCDate(end.getUTCDate() - (end.getUTCDay() + 7));
    }
    if (startStr === 'previous calendar month') {
      end.setUTCMonth(end.getUTCMonth(), 1);
    }
    if (startStr === 'previous calendar year') {
      end.setUTCFullYear(end.getUTCFullYear(), 0, 1);
    }
    filterEndDate = end.getTime();
  }

  const customShift =
    customStartDate &&
    Math.ceil((filterStartDate - customStartDate) / DAY_IN_MS);
  const inInheritShift =
    isInherit && Math.ceil((filterEndDate - filterStartDate) / DAY_IN_MS);

  let newShifts = shifts;
  if (isCustom) {
    newShifts = [`${customShift} days ago`];
  }
  if (isInherit) {
    newShifts = [`${inInheritShift} days ago`];
  }
  return ensureIsArray(newShifts);
};
