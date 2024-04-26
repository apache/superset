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
import moment, { Moment } from 'moment';
import { ensureIsArray } from '../utils';

export const parseDttmToMoment = (dttm: string): Moment => {
  if (dttm === 'now') {
    return moment().utc().startOf('second');
  }
  if (dttm === 'today' || dttm === 'No filter') {
    return moment().utc().startOf('day');
  }
  if (dttm === 'Last week') {
    return moment().utc().startOf('day').subtract(7, 'day');
  }
  if (dttm === 'Last month') {
    return moment().utc().startOf('day').subtract(1, 'month');
  }
  if (dttm === 'Last quarter') {
    return moment().utc().startOf('day').subtract(1, 'quarter');
  }
  if (dttm === 'Last year') {
    return moment().utc().startOf('day').subtract(1, 'year');
  }
  if (dttm === 'previous calendar week') {
    return moment().utc().subtract(1, 'weeks').startOf('isoWeek');
  }
  if (dttm === 'previous calendar month') {
    return moment().utc().subtract(1, 'months').startOf('month');
  }
  if (dttm === 'previous calendar year') {
    return moment().utc().subtract(1, 'years').startOf('year');
  }
  if (dttm.includes('ago')) {
    const parts = dttm.split(' ');
    const amount = parseInt(parts[0], 10);
    const unit = parts[1] as
      | 'day'
      | 'week'
      | 'month'
      | 'year'
      | 'days'
      | 'weeks'
      | 'months'
      | 'years';
    return moment().utc().subtract(amount, unit);
  }

  return moment(dttm);
};

export const getTimeOffset = (
  timeRangeFilter: any,
  shifts: string[],
  startDate: string,
): string[] => {
  const isCustom = shifts?.includes('custom');
  const isInherit = shifts?.includes('inherit');

  const customStartDate = isCustom && startDate;
  const customShift =
    customStartDate &&
    moment(
      parseDttmToMoment((timeRangeFilter as any).comparator.split(' : ')[0]),
    ).diff(moment(customStartDate), 'days');

  const inInheritShift =
    isInherit &&
    moment(
      parseDttmToMoment((timeRangeFilter as any).comparator.split(' : ')[1]),
    ).diff(
      moment(
        parseDttmToMoment((timeRangeFilter as any).comparator.split(' : ')[0]),
      ),
      'days',
    );
  let newShifts = shifts;
  if (isCustom) {
    newShifts = [`${customShift} days ago`];
  }
  if (isInherit) {
    newShifts = [`${inInheritShift} days ago`];
  }
  return ensureIsArray(newShifts);
};
