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

const DAY_MS = 24 * 60 * 60 * 1000;

// Index of the Monday-start week containing `ms` (cal-heatmap's default week
// start). 1970-01-01 is a Thursday, hence the +3 day offset.
const mondayWeekIndex = (ms: number) =>
  Math.floor((Math.floor(ms / DAY_MS) + 3) / 7);

/**
 * Ports the legacy CalHeatmapViz.get_data reshape: per-metric value maps
 * keyed by unix seconds, plus the domain range computed from the query's
 * time bounds. Month and week ranges count the calendar periods touched by
 * `[fromDttm, toDttm)`; the upper bound is exclusive.
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
  // Last whole millisecond strictly below the exclusive `toDttm` bound. The
  // ceil keeps a fractional bound just above a boundary inside the period
  // that boundary starts.
  const lastMs = Math.max(Math.ceil(toDttm) - 1, fromDttm);
  const last = new Date(lastMs);
  const diffSecs = (toDttm - fromDttm) / 1000;

  let range: number;
  if (domain === 'year') {
    range = end.getUTCFullYear() - start.getUTCFullYear() + 1;
  } else if (domain === 'month') {
    range =
      (last.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      last.getUTCMonth() -
      start.getUTCMonth() +
      1;
  } else if (domain === 'week') {
    range = mondayWeekIndex(lastMs) - mondayWeekIndex(fromDttm) + 1;
  } else if (domain === 'day') {
    range = Math.floor(diffSecs / (24 * 60 * 60)) + 1;
  } else {
    range = Math.floor(diffSecs / (60 * 60)) + 1;
  }

  return { data, start: fromDttm, domain, subdomain, range };
}
