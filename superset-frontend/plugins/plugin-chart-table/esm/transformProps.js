(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /**
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

extractTimegrain,
GenericDataType,
getMetricLabel,
getNumberFormatter,
getTimeFormatter,
getTimeFormatterForGranularity,
NumberFormats,
QueryMode,
smartDateFormatter,
TimeFormats } from

'@superset-ui/core';
import { getColorFormatters } from '@superset-ui/chart-controls';

import isEqualColumns from './utils/isEqualColumns';
import DateWithFormatter from './utils/DateWithFormatter';






const { PERCENT_3_POINT } = NumberFormats;
const { DATABASE_DATETIME } = TimeFormats;

function isNumeric(key, data = []) {
  return data.every(
  (x) => x[key] === null || x[key] === undefined || typeof x[key] === 'number');

}

const processDataRecords = memoizeOne(function processDataRecords(
data,
columns)
{
  if (!data || !data[0]) {
    return data || [];
  }
  const timeColumns = columns.filter(
  (column) => column.dataType === GenericDataType.TEMPORAL);


  if (timeColumns.length > 0) {
    return data.map((x) => {
      const datum = { ...x };
      timeColumns.forEach(({ key, formatter }) => {
        // Convert datetime with a custom date class so we can use `String(...)`
        // formatted value for global search, and `date.getTime()` for sorting.
        datum[key] = new DateWithFormatter(x[key], {
          formatter: formatter });

      });
      return datum;
    });
  }
  return data;
});

const processColumns = memoizeOne(function processColumns(
props)
{
  const {
    datasource: { columnFormats, verboseMap },
    rawFormData: {
      table_timestamp_format: tableTimestampFormat,
      metrics: metrics_,
      percent_metrics: percentMetrics_,
      column_config: columnConfig = {} },

    queriesData } =
  props;
  const granularity = extractTimegrain(props.rawFormData);
  const { data: records, colnames, coltypes } = queriesData[0] || {};
  // convert `metrics` and `percentMetrics` to the key names in `data.records`
  const metrics = (metrics_ != null ? metrics_ : []).map(getMetricLabel);
  const rawPercentMetrics = (percentMetrics_ != null ? percentMetrics_ : []).map(getMetricLabel);
  // column names for percent metrics always starts with a '%' sign.
  const percentMetrics = rawPercentMetrics.map((x) => `%${x}`);
  const metricsSet = new Set(metrics);
  const percentMetricsSet = new Set(percentMetrics);
  const rawPercentMetricsSet = new Set(rawPercentMetrics);

  const columns = (colnames || []).
  filter(
  (key) =>
  // if a metric was only added to percent_metrics, they should not show up in the table.
  !(rawPercentMetricsSet.has(key) && !metricsSet.has(key))).

  map((key, i) => {
    const label = (verboseMap == null ? void 0 : verboseMap[key]) || key;
    const dataType = coltypes[i];
    const config = columnConfig[key] || {};
    // for the purpose of presentation, only numeric values are treated as metrics
    // because users can also add things like `MAX(str_col)` as a metric.
    const isMetric = metricsSet.has(key) && isNumeric(key, records);
    const isPercentMetric = percentMetricsSet.has(key);
    const isTime = dataType === GenericDataType.TEMPORAL;
    const savedFormat = columnFormats == null ? void 0 : columnFormats[key];
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
      config };

  });
  return [metrics, percentMetrics, columns];




},
isEqualColumns);

/**
 * Automatically set page size based on number of cells.
 */
const getPageSize = (
pageSize,
numRecords,
numColumns) =>
{
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
chartProps) =>
{var _baseQuery2, _totalQuery, _getColorFormatters;
  const {
    height,
    width,
    rawFormData: formData,
    queriesData = [],
    filterState,
    ownState: serverPaginationData = {},
    hooks: { onAddFilter: onChangeFilter, setDataMask = () => {} } } =
  chartProps;

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
    conditional_formatting: conditionalFormatting } =
  formData;
  const timeGrain = extractTimegrain(formData);

  const [metrics, percentMetrics, columns] = processColumns(chartProps);

  let baseQuery;
  let countQuery;
  let totalQuery;
  let rowCount;
  if (serverPagination) {var _ref, _countQuery, _countQuery$data, _countQuery$data$;
    [baseQuery, countQuery, totalQuery] = queriesData;
    rowCount = (_ref = (_countQuery = countQuery) == null ? void 0 : (_countQuery$data = _countQuery.data) == null ? void 0 : (_countQuery$data$ = _countQuery$data[0]) == null ? void 0 : _countQuery$data$.rowcount) != null ? _ref : 0;
  } else {var _baseQuery$rowcount, _baseQuery;
    [baseQuery, totalQuery] = queriesData;
    rowCount = (_baseQuery$rowcount = (_baseQuery = baseQuery) == null ? void 0 : _baseQuery.rowcount) != null ? _baseQuery$rowcount : 0;
  }
  const data = processDataRecords((_baseQuery2 = baseQuery) == null ? void 0 : _baseQuery2.data, columns);
  const totals =
  showTotals && queryMode === QueryMode.aggregate ? (_totalQuery =
  totalQuery) == null ? void 0 : _totalQuery.data[0] :
  undefined;
  const columnColorFormatters = (_getColorFormatters =
  getColorFormatters(conditionalFormatting, data)) != null ? _getColorFormatters : [];

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
    pageSize: serverPagination ?
    serverPageLength :
    getPageSize(pageLength, data.length, columns.length),
    filters: filterState.filters,
    emitFilter,
    onChangeFilter,
    columnColorFormatters,
    timeGrain };

};const _default =

transformProps;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(PERCENT_3_POINT, "PERCENT_3_POINT", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/transformProps.ts");reactHotLoader.register(DATABASE_DATETIME, "DATABASE_DATETIME", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/transformProps.ts");reactHotLoader.register(isNumeric, "isNumeric", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/transformProps.ts");reactHotLoader.register(processDataRecords, "processDataRecords", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/transformProps.ts");reactHotLoader.register(processColumns, "processColumns", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/transformProps.ts");reactHotLoader.register(getPageSize, "getPageSize", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/transformProps.ts");reactHotLoader.register(transformProps, "transformProps", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/transformProps.ts");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/transformProps.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();