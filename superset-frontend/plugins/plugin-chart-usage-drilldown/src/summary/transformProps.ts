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
  ChartProps,
  DataRecord,
  getMetricLabel,
  getXAxisLabel,
} from '@superset-ui/core';
import { parseBucketSizes, pickStep, series } from './buckets';
import { UsageSummaryFormData, UsageSummaryProps } from './types';

export const DEFAULT_BAR_COLOR = { r: 157, g: 184, b: 168, a: 1 };
export const DEFAULT_SUCCESS_COLOR = { r: 74, g: 124, b: 94, a: 1 };
export const DEFAULT_FAILED_COLOR = { r: 200, g: 40, b: 40, a: 1 };

const rgb = ({ r, g, b }: { r: number; g: number; b: number }) =>
  `rgb(${r}, ${g}, ${b})`;

const sum = (data: DataRecord[], key: string) =>
  data.reduce((total, record) => total + (Number(record[key]) || 0), 0);

export default function transformProps(
  chartProps: ChartProps,
): UsageSummaryProps {
  const { width, height, rawFormData, queriesData, datasource } = chartProps;
  const formData = rawFormData as UsageSummaryFormData;
  const {
    metric,
    header,
    bucket_sizes: bucketSizes,
    value_unit: valueUnit = '',
    color_picker: color = DEFAULT_BAR_COLOR,
    success_metric: successMetric,
    failed_metric: failedMetric,
    success_color: successColor = DEFAULT_SUCCESS_COLOR,
    failed_color: failedColor = DEFAULT_FAILED_COLOR,
  } = formData;
  const { data = [], from_dttm: from, to_dttm: to } = queriesData[0] ?? {};
  const metricKey = getMetricLabel(metric);
  const timeKey = getXAxisLabel(formData) ?? '';
  const verboseMap: Record<string, string> = datasource?.verboseMap ?? {};
  const step = pickStep(data, timeKey, from, to);

  return {
    width,
    height,
    slots: series(data, timeKey, metricKey, step, from, to),
    step,
    period: from != null && to != null ? { from, to } : undefined,
    title: header?.trim() || verboseMap[metricKey] || metricKey,
    bucketSizes: parseBucketSizes(bucketSizes),
    barColor: rgb(color),
    valueUnit: valueUnit.trim(),
    status:
      successMetric && failedMetric
        ? {
            success: sum(data, getMetricLabel(successMetric)),
            failed: sum(data, getMetricLabel(failedMetric)),
            successColor: rgb(successColor),
            failedColor: rgb(failedColor),
          }
        : undefined,
  };
}
