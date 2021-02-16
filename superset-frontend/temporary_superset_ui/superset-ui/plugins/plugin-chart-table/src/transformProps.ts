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
import memoizeOne from 'memoize-one';
import {
  DataRecord,
  getNumberFormatter,
  NumberFormats,
  getTimeFormatter,
  smartDateFormatter,
  getTimeFormatterForGranularity,
  TimeFormatter,
  TimeFormats,
  GenericDataType,
  getMetricLabel,
  QueryMode,
} from '@superset-ui/core';

import isEqualColumns from './utils/isEqualColumns';
import DateWithFormatter from './utils/DateWithFormatter';
import { TableChartProps, TableChartTransformedProps, DataColumnMeta } from './types';

const { PERCENT_3_POINT } = NumberFormats;
const { DATABASE_DATETIME } = TimeFormats;
const TIME_COLUMN = '__timestamp';

function isTimeColumn(key: string) {
  return key === TIME_COLUMN;
}

function isNumeric(key: string, data: DataRecord[] = []) {
  return data.every(x => x[key] === null || x[key] === undefined || typeof x[key] === 'number');
}

const processDataRecords = memoizeOne(function processDataRecords(
  data: DataRecord[] | undefined,
  columns: DataColumnMeta[],
) {
  if (!data || !data[0]) {
    return data || [];
  }
  const timeColumns = columns.filter(column => column.dataType === GenericDataType.TEMPORAL);

  if (timeColumns.length > 0) {
    return data.map(x => {
      const datum = { ...x };
      timeColumns.forEach(({ key, formatter }) => {
        // Convert datetime with a custom date class so we can use `String(...)`
        // formatted value for global search, and `date.getTime()` for sorting.
        datum[key] = new DateWithFormatter(x[key], { formatter: formatter as TimeFormatter });
      });
      return datum;
    });
  }
  return data;
});

const processColumns = memoizeOne(function processColumns(props: TableChartProps) {
  const {
    datasource: { columnFormats, verboseMap },
    rawFormData: {
      table_timestamp_format: tableTimestampFormat,
      time_grain_sqla: granularity,
      metrics: metrics_,
      percent_metrics: percentMetrics_,
    },
    queriesData,
  } = props;
  const { data: records, colnames, coltypes } = queriesData[0] || {};
  // convert `metrics` and `percentMetrics` to the key names in `data.records`
  const metrics = (metrics_ ?? []).map(getMetricLabel);
  const rawPercentMetrics = (percentMetrics_ ?? []).map(getMetricLabel);
  // column names for percent metrics always starts with a '%' sign.
  const percentMetrics = rawPercentMetrics.map((x: string) => `%${x}`);
  const metricsSet = new Set(metrics);
  const percentMetricsSet = new Set(percentMetrics);
  const rawPercentMetricsSet = new Set(rawPercentMetrics);

  const columns: DataColumnMeta[] = (colnames || [])
    .filter(
      key =>
        // if a metric was only added to percent_metrics, they should not show up in the table.
        !(rawPercentMetricsSet.has(key) && !metricsSet.has(key)),
    )
    .map((key: string, i) => {
      const label = verboseMap?.[key] || key;
      const dataType = coltypes[i];
      // fallback to column level formats defined in datasource
      const format = columnFormats?.[key];
      // for the purpose of presentation, only numeric values are treated as metrics
      const isMetric = metricsSet.has(key) && isNumeric(key, records);
      const isPercentMetric = percentMetricsSet.has(key);
      const isTime = dataType === GenericDataType.TEMPORAL;
      let formatter;
      if (isTime) {
        const timeFormat = format || tableTimestampFormat;
        // When format is "Adaptive Formatting" (smart_date)
        if (timeFormat === smartDateFormatter.id) {
          if (isTimeColumn(key)) {
            // time column use formats based on granularity
            formatter = getTimeFormatterForGranularity(granularity);
          } else if (format) {
            // other columns respect the column-specific format
            formatter = getTimeFormatter(format);
          } else if (isNumeric(key, records)) {
            // if column is numeric values, it is considered a timestamp64
            formatter = getTimeFormatter(DATABASE_DATETIME);
          } else {
            // if no column-specific format, print cell as is
            formatter = String;
          }
        } else if (timeFormat) {
          formatter = getTimeFormatter(timeFormat);
        }
      } else if (isMetric) {
        formatter = getNumberFormatter(format);
      } else if (isPercentMetric) {
        // percent metrics have a default format
        formatter = getNumberFormatter(format || PERCENT_3_POINT);
      }
      return {
        key,
        label,
        dataType,
        isMetric,
        isPercentMetric,
        formatter,
      };
    });
  return [
    metrics,
    percentMetrics,
    columns,
  ] as [typeof metrics, typeof percentMetrics, typeof columns];
}, isEqualColumns);

/**
 * Automatically set page size based on number of cells.
 */
const getPageSize = (
  pageSize: number | string | null | undefined,
  numRecords: number,
  numColumns: number,
) => {
  if (typeof pageSize === 'number') {
    // NaN is also has typeof === 'number'
    return pageSize || 0;
  }
  if (typeof pageSize === 'string') {
    return Number(pageSize) || 0;
  }
  // when pageSize not set, automatically add pagination if too many records
  return numRecords * numColumns > 5000 ? 200 : 0;
};

export default function transformProps(chartProps: TableChartProps): TableChartTransformedProps {
  const {
    height,
    width,
    rawFormData: formData,
    queriesData,
    initialValues: filters = {},
    hooks: { onAddFilter: onChangeFilter },
  } = chartProps;

  const {
    align_pn: alignPositiveNegative = true,
    color_pn: colorPositiveNegative = true,
    show_cell_bars: showCellBars = true,
    include_search: includeSearch = false,
    page_length: pageSize,
    table_filter: tableFilter,
    order_desc: sortDesc = false,
    query_mode: queryMode,
  } = formData;

  const [metrics, percentMetrics, columns] = processColumns(chartProps);
  const data = processDataRecords(queriesData?.[0]?.data, columns);

  return {
    height,
    width,
    isRawRecords: queryMode === QueryMode.raw,
    data,
    columns,
    metrics,
    percentMetrics,
    alignPositiveNegative,
    colorPositiveNegative,
    showCellBars,
    sortDesc,
    includeSearch,
    pageSize: getPageSize(pageSize, data.length, columns.length),
    filters,
    emitFilter: tableFilter === true,
    onChangeFilter,
  };
}
