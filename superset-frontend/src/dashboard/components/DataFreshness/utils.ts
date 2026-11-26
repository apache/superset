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
import type { DashboardFreshness, DatasetFreshness } from './types';

/**
 * Format a freshness timestamp for display, in the configured
 * `DATA_FRESHNESS_DISPLAY_TIMEZONE` or else the viewer's own time zone.
 */
export const formatDataAsOf = (
  value: string,
  timezone?: string | null,
): string => {
  const parsed = extendedDayjs.utc(value);
  if (timezone) {
    try {
      return parsed.tz(timezone).format('lll');
    } catch {
      // An unknown zone name falls back to the viewer's zone.
    }
  }
  return parsed.local().format('lll');
};

/** How long ago a freshness timestamp was, e.g. "3 hours ago". */
export const fromNow = (value: string): string =>
  extendedDayjs.utc(value).fromNow();

/**
 * The freshness of the dataset behind a chart, looked up by the chart's
 * datasource key (`<id>__<type>`). Only table datasources carry freshness.
 */
export const getChartDatasetFreshness = (
  freshness: DashboardFreshness | undefined,
  datasource: string | undefined,
): DatasetFreshness | undefined => {
  if (!freshness || !datasource) {
    return undefined;
  }
  const [id, type] = datasource.split('__');
  if (type !== 'table') {
    return undefined;
  }
  return freshness.datasets.find(dataset => dataset.id === Number(id));
};
