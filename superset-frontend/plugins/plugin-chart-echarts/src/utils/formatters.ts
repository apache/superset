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

import {
  CurrencyFormatter,
  ensureIsArray,
  getNumberFormatter,
  getTimeFormatter,
  isSavedMetric,
  NumberFormats,
  QueryFormMetric,
  SMART_DATE_DETAILED_ID,
  SMART_DATE_ID,
  SMART_DATE_VERBOSE_ID,
  TimeFormatter,
  TimeGranularity,
  ValueFormatter,
} from '@superset-ui/core';

export const getSmartDateDetailedFormatter = () =>
  getTimeFormatter(SMART_DATE_DETAILED_ID);

export const getSmartDateFormatter = (timeGrain?: string) => {
  const baseFormatter = getTimeFormatter(SMART_DATE_ID);

  // If no time grain provided, use the standard smart date formatter
  if (!timeGrain) {
    return baseFormatter;
  }

  // Create a wrapper that normalizes dates based on time grain
  return new TimeFormatter({
    id: SMART_DATE_ID,
    label: baseFormatter.label,
    formatFunc: (date: Date) => {
      // Create a normalized date based on time grain to ensure consistent smart formatting
      const normalizedDate = new Date(date);

      // Always remove milliseconds to prevent .XXXms format
      normalizedDate.setMilliseconds(0);

      // For all time grains, normalize using UTC methods to avoid timezone issues
      if (timeGrain === TimeGranularity.YEAR) {
        // Set to January 1st at midnight UTC - smart formatter will show year
        const year = normalizedDate.getUTCFullYear();
        const cleanDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
        return baseFormatter(cleanDate);
      } else if (timeGrain === TimeGranularity.QUARTER) {
        // Set to first month of quarter, first day, midnight UTC
        const year = normalizedDate.getUTCFullYear();
        const month = normalizedDate.getUTCMonth();
        const quarterStartMonth = Math.floor(month / 3) * 3;
        const cleanDate = new Date(
          Date.UTC(year, quarterStartMonth, 1, 0, 0, 0, 0),
        );
        return baseFormatter(cleanDate);
      } else if (timeGrain === TimeGranularity.MONTH) {
        // Set to first of month at midnight UTC - smart formatter will show month name or year
        const year = normalizedDate.getUTCFullYear();
        const month = normalizedDate.getUTCMonth();
        const cleanDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
        return baseFormatter(cleanDate);
      } else if (
        timeGrain === TimeGranularity.WEEK ||
        timeGrain === TimeGranularity.WEEK_STARTING_SUNDAY ||
        timeGrain === TimeGranularity.WEEK_STARTING_MONDAY ||
        timeGrain === TimeGranularity.WEEK_ENDING_SATURDAY ||
        timeGrain === TimeGranularity.WEEK_ENDING_SUNDAY
      ) {
        // Set to midnight UTC, keep the day
        const year = normalizedDate.getUTCFullYear();
        const month = normalizedDate.getUTCMonth();
        const day = normalizedDate.getUTCDate();
        const cleanDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
        return baseFormatter(cleanDate);
      } else if (
        timeGrain === TimeGranularity.DAY ||
        timeGrain === TimeGranularity.DATE
      ) {
        // Set to midnight UTC
        const year = normalizedDate.getUTCFullYear();
        const month = normalizedDate.getUTCMonth();
        const day = normalizedDate.getUTCDate();
        const cleanDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
        return baseFormatter(cleanDate);
      } else if (
        timeGrain === TimeGranularity.HOUR ||
        timeGrain === TimeGranularity.THIRTY_MINUTES ||
        timeGrain === TimeGranularity.FIFTEEN_MINUTES ||
        timeGrain === TimeGranularity.TEN_MINUTES ||
        timeGrain === TimeGranularity.FIVE_MINUTES ||
        timeGrain === TimeGranularity.MINUTE ||
        timeGrain === TimeGranularity.SECOND
      ) {
        // Set to top of hour UTC
        const year = normalizedDate.getUTCFullYear();
        const month = normalizedDate.getUTCMonth();
        const day = normalizedDate.getUTCDate();
        const hour = normalizedDate.getUTCHours();
        const cleanDate = new Date(Date.UTC(year, month, day, hour, 0, 0, 0));
        return baseFormatter(cleanDate);
      }

      // Use the base formatter on the normalized date
      return baseFormatter(normalizedDate);
    },
  });
};

export const getSmartDateVerboseFormatter = () =>
  getTimeFormatter(SMART_DATE_VERBOSE_ID);

export const getPercentFormatter = (format?: string) =>
  getNumberFormatter(
    !format || format === NumberFormats.SMART_NUMBER
      ? NumberFormats.PERCENT
      : format,
  );

export const getYAxisFormatter = (
  metrics: QueryFormMetric[],
  forcePercentFormatter: boolean,
  customFormatters: Record<string, ValueFormatter>,
  defaultFormatter: ValueFormatter,
  format?: string,
) => {
  if (forcePercentFormatter) {
    return getPercentFormatter(format);
  }
  const metricsArray = ensureIsArray(metrics);
  if (
    metricsArray.every(isSavedMetric) &&
    metricsArray
      .map(metric => customFormatters[metric])
      .every(
        (formatter, _, formatters) =>
          formatter instanceof CurrencyFormatter &&
          (formatter as CurrencyFormatter)?.currency?.symbol ===
            (formatters[0] as CurrencyFormatter)?.currency?.symbol,
      )
  ) {
    return customFormatters[metricsArray[0]];
  }
  return defaultFormatter ?? getNumberFormatter();
};

export function getTooltipTimeFormatter(
  format?: string,
): TimeFormatter | StringConstructor {
  if (format === SMART_DATE_ID) {
    return getSmartDateVerboseFormatter();
  }
  if (format) {
    return getTimeFormatter(format);
  }
  return String;
}

export function getXAxisFormatter(
  format?: string,
  timeGrain?: string,
): TimeFormatter | StringConstructor | undefined {
  if (format === SMART_DATE_ID || !format) {
    return getSmartDateFormatter(timeGrain);
  }
  if (format) {
    return getTimeFormatter(format);
  }
  return String;
}
