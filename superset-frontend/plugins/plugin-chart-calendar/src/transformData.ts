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
import { t } from '@apache-superset/core/translation';
import { DTTM_ALIAS } from '@superset-ui/core';

export interface CalHeatmapPayload {
  data: Record<string, Record<string, unknown>>;
  start: number;
  domain?: string;
  subdomain?: string;
  range: number;
}

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

/** Adds calendar months, clamping the day like dateutil.relativedelta. */
const addMonths = (date: Date, months: number): Date => {
  const totalMonths = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths % 12;
  const day = Math.min(date.getUTCDate(), daysInMonth(year, month));
  return new Date(
    Date.UTC(
      year,
      month,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
};

/**
 * Calendar delta between two dates with dateutil.relativedelta semantics:
 * whole months first, then remaining days (weeks = days // 7).
 */
export const calendarDelta = (start: Date, end: Date) => {
  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());
  if (addMonths(start, months) > end) {
    months -= 1;
  }
  const anchor = addMonths(start, months);
  const days = Math.floor(
    (end.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000),
  );
  return {
    years: Math.trunc(months / 12),
    months: months % 12,
    weeks: Math.floor(days / 7),
  };
};

/**
 * Ports the legacy CalHeatmapViz.get_data reshape: per-metric value maps
 * keyed by unix seconds, plus the domain range computed from the query's
 * time bounds exactly like the backend's relativedelta arithmetic.
 */
export default function transformData(
  records: Record<string, unknown>[],
  metricLabels: string[],
  fromDttm: number | null | undefined,
  toDttm: number | null | undefined,
  domain: string,
  subdomain: string,
): CalHeatmapPayload {
  if (fromDttm == null || toDttm == null) {
    throw new Error(t('Please provide both time bounds (Since and Until)'));
  }
  const data: Record<string, Record<string, unknown>> = {};
  metricLabels.forEach(metric => {
    const values: Record<string, unknown> = {};
    records.forEach(record => {
      const timestamp = record[DTTM_ALIAS];
      if (timestamp != null) {
        values[String((timestamp as number) / 1000)] = record[metric];
      }
    });
    data[metric] = values;
  });

  const start = new Date(fromDttm);
  const end = new Date(toDttm);
  const delta = calendarDelta(start, end);
  const diffSecs = (toDttm - fromDttm) / 1000;

  let range: number;
  if (domain === 'year') {
    range = end.getUTCFullYear() - start.getUTCFullYear() + 1;
  } else if (domain === 'month') {
    range = delta.years * 12 + delta.months + 1;
  } else if (domain === 'week') {
    range = delta.years * 53 + delta.weeks + 1;
  } else if (domain === 'day') {
    range = Math.floor(diffSecs / (24 * 60 * 60)) + 1;
  } else {
    range = Math.floor(diffSecs / (60 * 60)) + 1;
  }

  return { data, start: fromDttm, domain, subdomain, range };
}
