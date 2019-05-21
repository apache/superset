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
/* eslint-disable sort-keys */

import { ChartProps, FormDataMetric, Metric } from '@superset-ui/chart';
import { getNumberFormatter, NumberFormats, NumberFormatter } from '@superset-ui/number-format';
import { getTimeFormatter, TimeFormatter } from '@superset-ui/time-format';

export default function transformProps(chartProps: ChartProps) {
  const { height, datasource, filters, formData, onAddFilter, payload } = chartProps;
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
  const { columnFormats, verboseMap } = datasource;
  const { records, columns } = payload.data;

  const metrics = ((rawMetrics as FormDataMetric[]) || [])
    .map(m => (m as Metric).label || (m as string))
    // Add percent metrics
    .concat(((percentMetrics as string[]) || []).map(m => `%${m}`))
    // Removing metrics (aggregates) that are strings
    .filter(m => typeof records[0][m as string] === 'number');

  const dataArray: {
    [key: string]: any;
  } = {};

  metrics.forEach(metric => {
    const arr = [];
    for (let i = 0; i < records.length; i += 1) {
      arr.push(records[i][metric]);
    }

    dataArray[metric] = arr;
  });

  const maxes: {
    [key: string]: number;
  } = {};
  const mins: {
    [key: string]: number;
  } = {};

  for (let i = 0; i < metrics.length; i += 1) {
    maxes[metrics[i]] = Math.max(...dataArray[metrics[i]]);
    mins[metrics[i]] = Math.min(...dataArray[metrics[i]]);
  }

  const formatPercent = getNumberFormatter(NumberFormats.PERCENT_3_POINT);
  const tsFormatter = getTimeFormatter(tableTimestampFormat);

  const processedColumns = columns.map((key: string) => {
    let label = verboseMap[key];
    let formatString = columnFormats && columnFormats[key];
    let formatFunction: NumberFormatter | TimeFormatter | undefined;
    let type = 'string';

    // Handle verbose names for percents
    if (!label) {
      if (key[0] === '%') {
        const cleanedKey = key.substring(1);
        label = `% ${verboseMap[cleanedKey] || cleanedKey}`;
        formatFunction = formatPercent;
      } else {
        label = key;
      }
    }

    if (key === '__timestamp') {
      formatFunction = tsFormatter;
    }

    const extraField: {
      [key: string]: any;
    } = {};

    if (metrics.indexOf(key) >= 0) {
      formatFunction = getNumberFormatter(formatString);
      type = 'metric';
      extraField['maxValue'] = maxes[key];
      extraField['minValue'] = mins[key];
    }
    return {
      key,
      label,
      format: formatFunction,
      type,
      ...extraField,
    };
  });

  return {
    height,
    data: records,
    alignPositiveNegative: alignPn,
    colorPositiveNegative: colorPn,
    columns: processedColumns,
    filters,
    includeSearch,
    metrics,
    onAddFilter,
    orderDesc,
    pageLength: pageLength && parseInt(pageLength, 10),
    percentMetrics,
    tableFilter,
    tableTimestampFormat,
    timeseriesLimitMetric,
  };
}
