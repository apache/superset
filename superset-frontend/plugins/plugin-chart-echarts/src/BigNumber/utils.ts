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

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
  getTimeFormatter,
  getTimeFormatterForGranularity,
  isAdhocMetricSimple,
  isSavedMetric,
  Metric,
  QueryFormMetric,
  SMART_DATE_ID,
  TimeGranularity,
} from '@superset-ui/core';

dayjs.extend(utc);

export const parseMetricValue = (metricValue: number | string | null) => {
  if (typeof metricValue === 'string') {
    const dateObject = dayjs.utc(metricValue, undefined, true);
    if (dateObject.isValid()) {
      return dateObject.valueOf();
    }
    return null;
  }
  return metricValue;
};

export const getDateFormatter = (
  timeFormat: string,
  granularity?: TimeGranularity,
  fallbackFormat?: string | null,
) =>
  timeFormat === SMART_DATE_ID
    ? getTimeFormatterForGranularity(granularity)
    : getTimeFormatter(timeFormat ?? fallbackFormat);

export function getOriginalLabel(
  metric: QueryFormMetric,
  metrics: Metric[] = [],
): string {
  const metricLabel = typeof metric === 'string' ? metric : metric.label || '';

  if (isSavedMetric(metric)) {
    const metricEntry = metrics.find(m => m.metric_name === metric);
    return (
      metricEntry?.verbose_name ||
      metricEntry?.metric_name ||
      metric ||
      'Unknown Metric'
    );
  }

  if (isAdhocMetricSimple(metric)) {
    const column = metric.column || {};
    const columnName = column.column_name || 'unknown_column';
    const verboseName = column.verbose_name || columnName;
    const aggregate = metric.aggregate || 'UNKNOWN';
    return metric.hasCustomLabel && metric.label
      ? metric.label
      : `${aggregate}(${verboseName})`;
  }

  if (
    typeof metric === 'object' &&
    'expressionType' in metric &&
    metric.expressionType === 'SQL' &&
    'sqlExpression' in metric
  ) {
    return metric.hasCustomLabel && metric.label
      ? metric.label
      : metricLabel || 'Custom Metric';
  }

  return metricLabel || 'Unknown Metric';
}
