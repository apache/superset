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
import { Dayjs } from 'dayjs';
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';

export type CalendarRange = [Dayjs | null, Dayjs | null];
export type DatePickerMode = 'date' | 'datetime';

/** Display day-first dates while keeping storage independent of display format. */
export function pickerFormat(mode: DatePickerMode): string {
  return mode === 'datetime' ? 'DD/MM/YYYY HH:mm' : 'DD/MM/YYYY';
}

/** Parse complete input strictly; never normalize an impossible date. */
export function parseTypedDate(
  text: string,
  mode: DatePickerMode,
): Dayjs | null {
  const formats =
    mode === 'datetime'
      ? [
          'DD/MM/YYYY HH:mm',
          'DD/MM/YYYY HH:mm:ss',
          'YYYY-MM-DD HH:mm',
          'YYYY-MM-DDTHH:mm:ss',
          'YYYY-MM-DD HH:mm:ss',
        ]
      : ['DD/MM/YYYY', 'YYYY-MM-DD'];
  for (const format of formats) {
    const date = dayjs(text.trim(), format, true);
    if (date.isValid()) return date;
  }
  return null;
}

/** Decode absolute timestamps without adding a day to a date-time endpoint. */
export function decodeDateTimeRange(value: string): CalendarRange {
  const parts = value.split(' : ');
  if (parts.length !== 2) return [null, null];
  const endpoints = parts.map(
    part => parseTypedDate(part, 'datetime') ?? parseTypedDate(part, 'date'),
  );
  const [start, end] = endpoints;
  return start && end && end.isAfter(start) ? [start, end] : [null, null];
}

/** Store exact date-time endpoints using Superset's exclusive end convention. */
export function encodeDateTimeRange(start: Dayjs, end: Dayjs): string {
  return `${start.format('YYYY-MM-DDTHH:mm:ss')} : ${end.format('YYYY-MM-DDTHH:mm:ss')}`;
}

/** Decode day boundaries without changing Superset's exclusive upper bound. */
export function decodeCalendarRange(value: string): CalendarRange {
  const parts = value.split(' : ');
  const midnight = /^\d{4}-\d{2}-\d{2}(?:[T ]00:00:00)?$/;
  if (parts.length !== 2 || !parts.every(part => midnight.test(part))) {
    return [null, null];
  }
  const [start, exclusiveEnd] = decodeDateTimeRange(value);
  if (!start || !exclusiveEnd) return [null, null];
  return [start.startOf('day'), exclusiveEnd.subtract(1, 'day').startOf('day')];
}

/** Include the whole last selected day in Superset's half-open time range. */
export function encodeCalendarRange(start: Dayjs, end: Dayjs): string {
  return `${start.format('YYYY-MM-DD')} : ${end.add(1, 'day').format('YYYY-MM-DD')}`;
}

/** Read the backend's resolved range using its unformatted date endpoints. */
export function decodeResolvedRange(
  value?: string,
  mode: DatePickerMode = 'date',
): CalendarRange {
  if (!value) return [null, null];
  const parts = value.split(' ≤ col < ');
  if (parts.length !== 2) return [null, null];
  const encoded = `${parts[0]} : ${parts[1]}`;
  return mode === 'datetime'
    ? decodeDateTimeRange(encoded)
    : decodeCalendarRange(encoded);
}
