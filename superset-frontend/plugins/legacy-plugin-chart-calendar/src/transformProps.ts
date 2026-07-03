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
  getNumberFormatter,
  QueryFormMetric,
} from '@superset-ui/core';
import { getFormattedUTCTime } from './utils';
import transformData from './transformData';

export default function transformProps(chartProps: ChartProps) {
  const { height, formData, queriesData, datasource } = chartProps;
  const {
    cellPadding,
    cellRadius,
    cellSize,
    domainGranularity,
    linearColorScheme,
    showLegend,
    showMetricName,
    showValues,
    steps,
    subdomainGranularity,
    xAxisTimeFormat,
    yAxisFormat,
  } = formData;

  const { verboseMap } = datasource;
  const timeFormatter = (ts: number | string) =>
    getFormattedUTCTime(ts, xAxisTimeFormat);
  const valueFormatter = getNumberFormatter(yAxisFormat);

  // The legacy explore_json endpoint computed the per-metric value maps
  // and domain range server-side; v1 responses arrive as flat records.
  const { data: rawData, from_dttm: fromDttm, to_dttm: toDttm } =
    queriesData[0];
  const data = Array.isArray(rawData)
    ? transformData(
        rawData,
        ensureIsArray(formData.metrics as QueryFormMetric[]).map(
          getMetricLabel,
        ),
        fromDttm,
        toDttm,
        domainGranularity,
        subdomainGranularity,
      )
    : rawData;

  return {
    height,
    data,
    cellPadding,
    cellRadius,
    cellSize,
    domainGranularity,
    linearColorScheme,
    showLegend,
    showMetricName,
    showValues,
    steps,
    subdomainGranularity,
    timeFormatter,
    valueFormatter,
    verboseMap,
  };
}
