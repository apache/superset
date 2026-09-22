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

export function parseTimeRange(value?: string | null): DateRangeValue {
  if (!value) return null;
  const [start, end] = value.split(RANGE_SEPARATOR);
  const startDate = dayjs(start);
  const endDate = dayjs(end);
  if (!startDate.isValid() || !endDate.isValid()) return null;
  return [startDate, endDate];
}

export function formatTimeRange(dates: DateRangeValue): string | undefined {
  const [start, end] = dates ?? [null, null];
  if (!start || !end) return undefined;
  return `${start.format(DATE_FORMAT)}${RANGE_SEPARATOR}${end.format(DATE_FORMAT)}`;
}
