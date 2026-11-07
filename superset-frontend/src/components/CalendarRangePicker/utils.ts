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
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import { NO_TIME_RANGE, SEPARATOR } from '@superset-ui/core';
import type { Dayjs } from 'dayjs';

export const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';

const parseSingleDate = (
  dateStr?: string | null,
  format?: string,
): Dayjs | null => {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }
  const trimmed = dateStr.trim();
  if (!trimmed) {
    return null;
  }

  // First try parsing with explicit custom format if provided
  if (format && format !== DEFAULT_DATE_FORMAT) {
    const formatted = extendedDayjs(trimmed, format, true);
    if (formatted.isValid()) {
      return formatted;
    }
  }

  // Try standard extendedDayjs parsing (ISO, YYYY-MM-DD, etc.)
  const parsed = extendedDayjs(trimmed);
  if (parsed.isValid()) {
    return parsed;
  }

  // Fallback to non-strict format parsing if needed
  if (format) {
    const loose = extendedDayjs(trimmed, format);
    if (loose.isValid()) {
      return loose;
    }
  }

  return null;
};

export const parseRangeValue = (
  value?: string | null,
  format: string = DEFAULT_DATE_FORMAT,
): [Dayjs | null, Dayjs | null] | null => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === NO_TIME_RANGE) {
    return null;
  }

  if (trimmed.includes(SEPARATOR) || trimmed.includes(' : ')) {
    const parts = trimmed.split(/\s*:\s*/);
    const startStr = parts[0];
    const endStr = parts[1];

    const start = parseSingleDate(startStr, format);
    const end = parseSingleDate(endStr, format);

    if (!start && !end) {
      return null;
    }
    return [start, end];
  }

  // Handle single date input
  const single = parseSingleDate(trimmed, format);
  if (single) {
    return [single, single];
  }

  return null;
};

export const formatRangeValue = (
  dates: [Dayjs | null, Dayjs | null] | null,
  format: string = DEFAULT_DATE_FORMAT,
  clearValue: string = '',
): string => {
  if (
    !dates ||
    !dates[0] ||
    !dates[1] ||
    !dates[0].isValid() ||
    !dates[1].isValid()
  ) {
    return clearValue;
  }
  return `${dates[0].format(format)}${SEPARATOR}${dates[1].format(format)}`;
};
