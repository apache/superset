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
  ensureIsArray,
  getMetricLabel,
  QueryFormMetric,
} from '@superset-ui/core';
import transformData from './transformData';

export default function transformProps(chartProps: ChartProps) {
  const { width, height, formData, queriesData } = chartProps;
  const {
    colorScheme,
    dateTimeFormat,
    numberFormat,
    richTooltip,
    roseAreaProportion,
    sliceId,
    metrics,
    timeCompare,
    comparisonType,
  } = formData;

  // v1 responses arrive as flattened pivot records; the legacy
  // explore_json endpoint delivered the timestamp-keyed shape directly.
  const rawData = queriesData[0].data;
  const data = Array.isArray(rawData)
    ? transformData(rawData, {
        metricLabels: ensureIsArray(metrics as QueryFormMetric[]).map(
          getMetricLabel,
        ),
        timeCompare: ensureIsArray(timeCompare),
        comparisonType:
          comparisonType === 'absolute' ? 'difference' : comparisonType,
      })
    : rawData;

  return {
    width,
    height,
    data,
    colorScheme,
    dateTimeFormat,
    numberFormat,
    useAreaProportions: roseAreaProportion,
    useRichTooltip: richTooltip,
    sliceId,
  };
}
