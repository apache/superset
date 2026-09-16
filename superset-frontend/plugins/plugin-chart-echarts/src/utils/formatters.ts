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
  NumberFormatter,
  QueryFormMetric,
  SMART_DATE_DETAILED_ID,
  SMART_DATE_ID,
  SMART_DATE_VERBOSE_ID,
  TimeFormatter,
  TimeGranularity,
  ValueFormatter,
} from '@superset-ui/core';
import { TIMESERIES_CONSTANTS } from '../constants';

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
      } else if (timeGrain === TimeGranularity.HOUR) {
        // Set to top of hour UTC - smart formatter will show hour
        const year = normalizedDate.getUTCFullYear();
        const month = normalizedDate.getUTCMonth();
        const day = normalizedDate.getUTCDate();
        const hour = normalizedDate.getUTCHours();
        const cleanDate = new Date(Date.UTC(year, month, day, hour, 0, 0, 0));
        return baseFormatter(cleanDate);
      } else if (
        timeGrain === TimeGranularity.THIRTY_MINUTES ||
        timeGrain === TimeGranularity.FIFTEEN_MINUTES ||
        timeGrain === TimeGranularity.TEN_MINUTES ||
        timeGrain === TimeGranularity.FIVE_MINUTES ||
        timeGrain === TimeGranularity.MINUTE
      ) {
        // Preserve hour and minute for sub-hour grains
        const year = normalizedDate.getUTCFullYear();
        const month = normalizedDate.getUTCMonth();
        const day = normalizedDate.getUTCDate();
        const hour = normalizedDate.getUTCHours();
        const minute = normalizedDate.getUTCMinutes();
        const cleanDate = new Date(
          Date.UTC(year, month, day, hour, minute, 0, 0),
        );
        return baseFormatter(cleanDate);
      } else if (timeGrain === TimeGranularity.SECOND) {
        // Preserve hour, minute, and second for second-level grain
        const year = normalizedDate.getUTCFullYear();
        const month = normalizedDate.getUTCMonth();
        const day = normalizedDate.getUTCDate();
        const hour = normalizedDate.getUTCHours();
        const minute = normalizedDate.getUTCMinutes();
        const second = normalizedDate.getUTCSeconds();
        const cleanDate = new Date(
          Date.UTC(year, month, day, hour, minute, second, 0),
        );
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
  timeGrain?: TimeGranularity,
): TimeFormatter | StringConstructor {
  // When a time grain is active and the user hasn't pinned an explicit format,
  // honor the grain so tooltips read "Jan 2021", "2021 Q1", "2021", weekly
  // ranges, etc. instead of a fixed timestamp. An explicit custom format is
  // always respected verbatim.
  if (!format || format === SMART_DATE_ID) {
    if (timeGrain) {
      return getTimeFormatter(undefined, timeGrain);
    }
    if (format === SMART_DATE_ID) {
      return getSmartDateVerboseFormatter();
    }
    return String;
  }
  return getTimeFormatter(format);
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

type XAxisFormatterFn =
  | TimeFormatter
  | NumberFormatter
  | StringConstructor
  | ((value: number | string) => string);

/**
 * Wraps an x-axis time formatter so that consecutive ticks that format to
 * identical text are blanked (e.g. the boundary label forced by
 * showMaxLabel duplicating the last real tick).
 *
 * Use this instead of createSpacedXAxisFormatter when the axis geometry
 * doesn't match the spacing model's horizontal-plot assumptions, e.g. a
 * horizontal orientation chart, where the time axis runs vertically along
 * the side of the chart rather than along the bottom.
 */
export function createDedupXAxisFormatter(
  xAxisFormatter: XAxisFormatterFn | undefined,
): (value: number | string) => string {
  let lastLabel: string | undefined;
  let lastValue: number | undefined;
  const wrapper = (value: number | string) => {
    // ECharts formats the labels in repeated ascending passes. Reset the
    // dedup state when the sequence restarts so a forced boundary label
    // (e.g. the min date) isn't blanked by the previous pass's last label
    // when both format identically (e.g. a May-to-May range).
    if (
      typeof value === 'number' &&
      lastValue !== undefined &&
      value <= lastValue
    ) {
      lastLabel = undefined;
    }
    if (typeof value === 'number') {
      lastValue = value;
    }
    const label =
      typeof xAxisFormatter === 'function'
        ? (xAxisFormatter as Function)(value)
        : String(value);
    if (label === lastLabel) {
      return '';
    }
    lastLabel = label;
    return label;
  };
  if (typeof xAxisFormatter === 'function' && 'id' in xAxisFormatter) {
    (wrapper as { id?: unknown }).id = (xAxisFormatter as { id?: unknown }).id;
  }
  return wrapper;
}

/**
 * Wraps an x-axis time formatter so that:
 * - consecutive ticks that format to identical text are blanked (e.g. the
 *   boundary label forced by showMaxLabel duplicating the last real tick).
 * - ticks that would render close enough to visually collide with the
 *   previously shown label are blanked, since disabling ECharts'
 *   `hideOverlap` (required to keep the forced boundary label visible, see
 *   #39899) also disables its native overlap suppression for every other
 *   label on the axis.
 *
 * The forced axis boundary labels (domainMin/domainMax) are never blanked by
 * the spacing check so they stay visible regardless of density.
 */
export function createSpacedXAxisFormatter(
  xAxisFormatter: XAxisFormatterFn | undefined,
  domainMin: number | undefined,
  domainMax: number | undefined,
  plotWidthPx: number,
): (value: number | string) => string {
  const pixelsPerMs =
    domainMin !== undefined && domainMax !== undefined && domainMax > domainMin
      ? plotWidthPx / (domainMax - domainMin)
      : undefined;
  let lastLabel: string | undefined;
  let lastValue: number | undefined;
  let lastShownValue: number | undefined;
  const wrapper = (value: number | string) => {
    // ECharts formats the labels in repeated ascending passes. Reset the
    // dedup/spacing state when the sequence restarts so a forced boundary
    // label (e.g. the min date) isn't blanked by the previous pass's state
    // when both format identically (e.g. a May-to-May range).
    if (
      typeof value === 'number' &&
      lastValue !== undefined &&
      value <= lastValue
    ) {
      lastLabel = undefined;
      lastShownValue = undefined;
    }
    if (typeof value === 'number') {
      lastValue = value;
    }
    const label =
      typeof xAxisFormatter === 'function'
        ? (xAxisFormatter as Function)(value)
        : String(value);
    if (label === lastLabel) {
      return '';
    }
    const isBoundary =
      typeof value === 'number' && (value === domainMin || value === domainMax);
    if (
      !isBoundary &&
      typeof value === 'number' &&
      pixelsPerMs !== undefined &&
      lastShownValue !== undefined &&
      (value - lastShownValue) * pixelsPerMs <
        label.length * TIMESERIES_CONSTANTS.xAxisLabelCharWidthPx +
          TIMESERIES_CONSTANTS.xAxisLabelMinGapPx
    ) {
      return '';
    }
    lastLabel = label;
    if (typeof value === 'number') {
      lastShownValue = value;
    }
    return label;
  };
  if (typeof xAxisFormatter === 'function' && 'id' in xAxisFormatter) {
    (wrapper as { id?: unknown }).id = (xAxisFormatter as { id?: unknown }).id;
  }
  return wrapper;
}

/**
 * Computes the [min, max] of a temporal x-axis column across one or more
 * data record arrays, for use with createSpacedXAxisFormatter.
 */
export function getXAxisDomain(
  dataRecordArrays: Record<string, unknown>[][],
  xAxisCol: string,
): [number | undefined, number | undefined] {
  let domainMin: number | undefined;
  let domainMax: number | undefined;
  dataRecordArrays.forEach(records => {
    records.forEach(record => {
      const value = record[xAxisCol];
      if (typeof value === 'number') {
        if (domainMin === undefined || value < domainMin) domainMin = value;
        if (domainMax === undefined || value > domainMax) domainMax = value;
      }
    });
  });
  return [domainMin, domainMax];
}
