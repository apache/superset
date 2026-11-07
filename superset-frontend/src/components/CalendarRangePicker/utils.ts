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

export const parseSingleDate = (
  dateStr?: string | null,
  format: string = DEFAULT_DATE_FORMAT,
): Dayjs | null => {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }
  const trimmed = dateStr.trim();
  if (!trimmed) {
    return null;
  }

  // 1. Strict parsing with configured format (handles DEFAULT_DATE_FORMAT and custom formats)
  if (format) {
    const strictParsed = extendedDayjs(trimmed, format, true);
    if (strictParsed.isValid()) {
      return strictParsed;
    }
  }

  // 2. Strict ISO parsing for datetime strings (with T or space before time)
  if (trimmed.includes('T') || /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(trimmed)) {
    const isoParsed = extendedDayjs(trimmed);
    if (isoParsed.isValid()) {
      // Prevent rollover in ISO strings (e.g., 2026-02-31T00:00:00 or non-leap 2026-02-29)
      const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const y = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const d = parseInt(match[3], 10);
        if (
          isoParsed.year() !== y ||
          isoParsed.month() + 1 !== m ||
          isoParsed.date() !== d
        ) {
          return null;
        }
      }
      return isoParsed;
    }
  }

  // 3. Fallback: if a custom format was provided, try strict DEFAULT_DATE_FORMAT as standard fallback
  if (format !== DEFAULT_DATE_FORMAT) {
    const standardParsed = extendedDayjs(trimmed, DEFAULT_DATE_FORMAT, true);
    if (standardParsed.isValid()) {
      return standardParsed;
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

  // Dangling colons at start or end represent malformed/partial inputs
  if (trimmed.startsWith(':') || trimmed.endsWith(':')) {
    return null;
  }

  // Split on whitespace-delimited range separator (protects colons inside HH:mm:ss timestamps)
  if (trimmed.includes(SEPARATOR) || /\s+:\s+/.test(trimmed)) {
    const parts = trimmed.split(/\s+:\s+/);
    if (parts.length !== 2) {
      return null;
    }

    const start = parseSingleDate(parts[0], format);
    const end = parseSingleDate(parts[1], format);

    // Closed range contract: both endpoints must be valid
    if (!start || !end) {
      return null;
    }
    return [start, end];
  }

  // Handle single valid date input (duplicates for both boundaries)
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
