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

import { ChartProps } from '@superset-ui/core';
import getProcessColumnsFunction from '../processColumns';
import getProcessMetricsFunction from '../processMetrics';
import getProcessDataFunction from '../processData';

const processColumns = getProcessColumnsFunction();
const processMetrics = getProcessMetricsFunction();
const processData = getProcessDataFunction();

const NOOP = () => {};

export default function transformProps(chartProps: ChartProps) {
  const { height, datasource, initialValues, formData, hooks, queriesData, width } = chartProps;

  const { onAddFilter = NOOP } = hooks;

  const {
    alignPn,
    colorPn,
    includeSearch,
    metrics: rawMetrics,
    orderDesc,
    pageLength,
    percentMetrics,
    tableFilter,
    tableTimestampFormat,
    timeseriesLimitMetric,
  } = formData;
  const { records, columns } = queriesData[0].data;

  const metrics = processMetrics({
    metrics: rawMetrics,
    percentMetrics,
    records,
  });

  const processedData = processData({
    timeseriesLimitMetric,
    orderDesc,
    records,
    metrics,
  });

  const processedColumns = processColumns({
    columns,
    metrics,
    records,
    tableTimestampFormat,
    datasource,
  });

  return {
    height,
    width,
    data: processedData,
    alignPositiveNegative: alignPn,
    colorPositiveNegative: colorPn,
    columns: processedColumns,
    filters: initialValues,
    includeSearch,
    onAddFilter,
    orderDesc,
    pageLength: pageLength && parseInt(pageLength, 10),
    tableFilter,
  };
}
