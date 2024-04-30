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

  if (dttm === 'now' || dttm === 'today' || dttm === 'No filter') {
    return now;
  }
  if (dttm === 'Last week') {
    now.setUTCDate(now.getUTCDate() - 7);
    return now;
  }
  if (dttm === 'Last month') {
    now.setUTCMonth(now.getUTCMonth() - 1);
    now.setUTCDate(1);
    return now;
  }
  if (dttm === 'Last quarter') {
    now.setUTCMonth(now.getUTCMonth() - 3);
    now.setUTCDate(1);
    return now;
  }
  if (dttm === 'Last year') {
    now.setUTCFullYear(now.getUTCFullYear() - 1);
    now.setUTCDate(1);
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
  const filterStartDate = parseDttmToDate(
    timeRangeFilter.comparator.split(' : ')[0],
  ).getTime();
  const filterEndDate = parseDttmToDate(
    timeRangeFilter.comparator.split(' : ')[1],
  ).getTime();

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
