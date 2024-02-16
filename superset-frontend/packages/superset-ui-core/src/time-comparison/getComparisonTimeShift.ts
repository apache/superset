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
import { ComparisonTimeRangeType } from './types';

export const getComparisonTimeShift = (
  startDate: Moment | null,
  endDate: Moment | null,
  calcType: String,
) => {
  if (!startDate || !endDate) {
    return [null, null];
  }

  const daysBetween = endDate.diff(startDate, 'days');

  let startDatePrev = moment();
  let endDatePrev = moment();
  if (calcType === ComparisonTimeRangeType.Year) {
    startDatePrev = startDate.subtract(1, 'year');
    endDatePrev = endDate.subtract(1, 'year');
  } else if (calcType === ComparisonTimeRangeType.Week) {
    startDatePrev = startDate.subtract(1, 'week');
    endDatePrev = endDate.subtract(1, 'week');
  } else if (calcType === ComparisonTimeRangeType.Month) {
    startDatePrev = startDate.subtract(1, 'month');
    endDatePrev = endDate.subtract(1, 'month');
  } else if (calcType === ComparisonTimeRangeType.InheritedRange) {
    startDatePrev = startDate.clone().subtract(daysBetween.valueOf(), 'day');
    endDatePrev = startDate;
  } else {
    startDatePrev = startDate.subtract(1, 'year');
    endDatePrev = endDate.subtract(1, 'year');
  }

  return [startDatePrev, endDatePrev];
};

export default getComparisonTimeShift;
