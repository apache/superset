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

import { ChartProps, Metric, FormDataMetric } from '@superset-ui/chart';

const DTTM_ALIAS = '__timestamp';

function transformData(data: ChartProps['payload'][], formData: ChartProps['formData']) {
  const columns = new Set(
    [...formData.groupby, ...formData.metrics, ...formData.allColumns].map(
      column => column.label || column,
    ),
  );

  let records = data;

  // handle timestamp columns
  if (formData.includeTime) {
    columns.add(DTTM_ALIAS);
  }

  // handle percentage columns.
  const percentMetrics: string[] = (formData.percentMetrics || []).map(
    (metric: FormDataMetric) => (metric as Metric).label || (metric as string),
  );
  if (percentMetrics.length > 0) {
    const sumPercentMetrics = data.reduce((sumMetrics, item) => {
      const newSumMetrics = { ...sumMetrics };
      percentMetrics.forEach(metric => {
        newSumMetrics[metric] = (sumMetrics[metric] || 0) + (item[metric] || 0);
      });
      return newSumMetrics;
    }, {});
    records = data.map(item => {
      const newItem = { ...item };
      percentMetrics.forEach(metric => {
        newItem[`%${metric}`] =
          sumPercentMetrics[metric] !== 0 ? newItem[metric] / sumPercentMetrics[metric] : null;
      });
      return newItem;
    });
    percentMetrics.forEach(metric => {
      columns.add(`%${metric}`);
    });
  }

  // handle sortedby column
  if (formData.timeseriesLimitMetric) {
    const metric = formData.timeseriesLimitMetric.label || formData.timeseriesLimitMetric;
    columns.add(metric);
  }

  return {
    records,
    columns: [...columns],
  };
}

export default function transformProps(chartProps: ChartProps) {
  const { height, datasource, filters, formData, onAddFilter, payload } = chartProps;
  const {
    alignPn,
    colorPn,
    includeSearch,
    metrics,
    orderDesc,
    pageLength,
    percentMetrics,
    tableFilter,
    tableTimestampFormat,
    timeseriesLimitMetric,
  } = formData;
  const { columnFormats, verboseMap } = datasource;
  const data = payload.data || payload[0].data;
  const { records, columns } = transformData(data, formData);

  const processedColumns = columns.map((key: string) => {
    let label = verboseMap[key];
    // Handle verbose names for percents
    if (!label) {
      label = key;
    }
    return {
      key,
      label,
      format: columnFormats && columnFormats[key],
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
