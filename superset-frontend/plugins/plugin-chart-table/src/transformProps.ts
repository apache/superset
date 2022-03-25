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
  extractTimegrain,
  GenericDataType,
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  getTimeFormatterForGranularity,
  NumberFormats,
  QueryMode,
  smartDateFormatter,
  TimeFormats,
  TimeFormatter,
} from '@superset-ui/core';
import { getColorFormatters } from '@superset-ui/chart-controls';

import isEqualColumns from './utils/isEqualColumns';
import DateWithFormatter from './utils/DateWithFormatter';
import {
  DataColumnMeta,
  TableChartProps,
  TableChartTransformedProps,
} from './types';

const { PERCENT_3_POINT } = NumberFormats;
const { DATABASE_DATETIME } = TimeFormats;

function isNumeric(key: string, data: DataRecord[] = []) {
  return data.every(
    x => x[key] === null || x[key] === undefined || typeof x[key] === 'number',
  );
}

const processDataRecords = memoizeOne(function processDataRecords(
  data: DataRecord[] | undefined,
  columns: DataColumnMeta[],
) {
  if (!data || !data[0]) {
    return data || [];
  }
  const timeColumns = columns.filter(
    column => column.dataType === GenericDataType.TEMPORAL,
  );

  if (timeColumns.length > 0) {
    return data.map(x => {
      const datum = { ...x };
      timeColumns.forEach(({ key, formatter }) => {
        // Convert datetime with a custom date class so we can use `String(...)`
        // formatted value for global search, and `date.getTime()` for sorting.
        datum[key] = new DateWithFormatter(x[key], {
          formatter: formatter as TimeFormatter,
        });
      });
      return datum;
    });
  }
  return data;
});

const processColumns = memoizeOne(function processColumns(
  props: TableChartProps,
) {
  const {
    datasource: { columnFormats, verboseMap },
    rawFormData: {
      table_timestamp_format: tableTimestampFormat,
      metrics: metrics_,
      percent_metrics: percentMetrics_,
      column_config: columnConfig = {},
    },
    queriesData,
  } = props;
  const granularity = extractTimegrain(props.rawFormData);
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
      const config = columnConfig[key] || {};
      // for the purpose of presentation, only numeric values are treated as metrics
      // because users can also add things like `MAX(str_col)` as a metric.
      const isMetric = metricsSet.has(key) && isNumeric(key, records);
      const isPercentMetric = percentMetricsSet.has(key);
      const isTime = dataType === GenericDataType.TEMPORAL;
      const savedFormat = columnFormats?.[key];
      const numberFormat = config.d3NumberFormat || savedFormat;

      let formatter;

      if (isTime || config.d3TimeFormat) {
        // string types may also apply d3-time format
        // pick adhoc format first, fallback to column level formats defined in
        // datasource
        const customFormat = config.d3TimeFormat || savedFormat;
        const timeFormat = customFormat || tableTimestampFormat;
        // When format is "Adaptive Formatting" (smart_date)
        if (timeFormat === smartDateFormatter.id) {
          if (granularity) {
            // time column use formats based on granularity
            formatter = getTimeFormatterForGranularity(granularity);
          } else if (customFormat) {
            // other columns respect the column-specific format
            formatter = getTimeFormatter(customFormat);
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
      } else if (isPercentMetric) {
        // percent metrics have a default format
        formatter = getNumberFormatter(numberFormat || PERCENT_3_POINT);
      } else if (isMetric || numberFormat) {
        formatter = getNumberFormatter(numberFormat);
      }
      return {
        key,
        label,
        dataType,
        isNumeric: dataType === GenericDataType.NUMERIC,
        isMetric,
        isPercentMetric,
        formatter,
        config,
      };
    });
  return [metrics, percentMetrics, columns] as [
    typeof metrics,
    typeof percentMetrics,
    typeof columns,
  ];
},
isEqualColumns);

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

const transformProps = (
  chartProps: TableChartProps,
): TableChartTransformedProps => {
  const {
    height,
    width,
    rawFormData: formData,
    queriesData = [],
    filterState,
    ownState: serverPaginationData = {},
    hooks: { onAddFilter: onChangeFilter, setDataMask = () => {} },
  } = chartProps;

  const {
    align_pn: alignPositiveNegative = true,
    color_pn: colorPositiveNegative = true,
    show_cell_bars: showCellBars = true,
    include_search: includeSearch = false,
    page_length: pageLength,
    emit_filter: emitFilter,
    server_pagination: serverPagination = false,
    server_page_length: serverPageLength = 10,
    order_desc: sortDesc = false,
    query_mode: queryMode,
    show_totals: showTotals,
    conditional_formatting: conditionalFormatting,
    rearrange_columns: rearrangeColumns,
  } = formData;
  const timeGrain = extractTimegrain(formData);

  const [metrics, percentMetrics, columns] = processColumns(chartProps);

  let baseQuery;
  let countQuery;
  let totalQuery;
  let rowCount;
  if (serverPagination) {
    [baseQuery, countQuery, totalQuery] = queriesData;
    rowCount = (countQuery?.data?.[0]?.rowcount as number) ?? 0;
  } else {
    [baseQuery, totalQuery] = queriesData;
    rowCount = baseQuery?.rowcount ?? 0;
  }
  const data = processDataRecords(baseQuery?.data, columns);
  const totals =
    showTotals && queryMode === QueryMode.aggregate
      ? totalQuery?.data[0]
      : undefined;
  const columnColorFormatters =
    getColorFormatters(conditionalFormatting, data) ?? [];

  return {
    height,
    width,
    isRawRecords: queryMode === QueryMode.raw,
    data,
    totals,
    columns,
    serverPagination,
    metrics,
    percentMetrics,
    serverPaginationData,
    setDataMask,
    alignPositiveNegative,
    colorPositiveNegative,
    showCellBars,
    sortDesc,
    includeSearch,
    rowCount,
    pageSize: serverPagination
      ? serverPageLength
      : getPageSize(pageLength, data.length, columns.length),
    filters: filterState.filters,
    emitFilter,
    onChangeFilter,
    columnColorFormatters,
    timeGrain,
    rearrangeColumns,
  };
};

export default transformProps;
