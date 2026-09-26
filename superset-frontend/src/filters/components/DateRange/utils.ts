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
import dayjs, { Dayjs } from 'dayjs';

export const DATE_FORMAT = 'YYYY-MM-DD';
export const RANGE_SEPARATOR = ' : ';

export type DateRangeValue = [Dayjs | null, Dayjs | null] | null;

// Superset's time_range filter treats the upper bound as exclusive
// (`col < end_dttm`, see superset/models/helpers.py get_time_filter), so the
// stored end date is the day AFTER the one the user picked — otherwise the
// entire selected end day would be excluded from query results. Displaying
// it back to the user reverses that offset so round-tripping stays exact.
export function parseTimeRange(value?: string | null): DateRangeValue {
  if (!value) return null;
  const parts = value.split(RANGE_SEPARATOR);
  if (parts.length !== 2) return null;
  const [start, end] = parts;
  const startDate = dayjs(start);
  const endDate = dayjs(end);
  if (!startDate.isValid() || !endDate.isValid()) return null;
  return [startDate, endDate.subtract(1, 'day')];
}

export function formatTimeRange(dates: DateRangeValue): string | undefined {
  const [start, end] = dates ?? [null, null];
  if (!start || !end) return undefined;
  const exclusiveEnd = end.add(1, 'day');
  return `${start.format(DATE_FORMAT)}${RANGE_SEPARATOR}${exclusiveEnd.format(DATE_FORMAT)}`;
}
