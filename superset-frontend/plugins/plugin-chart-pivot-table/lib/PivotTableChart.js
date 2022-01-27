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
import React, { useCallback, useMemo } from 'react';
import { PlusSquareOutlined, MinusSquareOutlined } from '@ant-design/icons';
import {


getColumnLabel,
getNumberFormatter,
isPhysicalColumn,

styled,
useTheme } from
'@superset-ui/core';
import { isAdhocColumn } from '@superset-ui/chart-controls';
import { PivotTable, sortAs, aggregatorTemplates } from './react-pivottable';
import {

MetricsLayoutEnum } from



'./types';import { jsx as ___EmotionJSX } from "@emotion/react";

const Styles = styled.div`
  ${({ height, width, margin }) => `
      margin: ${margin}px;
      height: ${height - margin * 2}px;
      width: ${
typeof width === 'string' ? parseInt(width, 10) : width - margin * 2
}px;
 `}
`;

const PivotTableWrapper = styled.div`
  height: 100%;
  max-width: fit-content;
  overflow: auto;
`;

const METRIC_KEY = 'metric';
const iconStyle = { stroke: 'black', strokeWidth: '16px' };
const vals = ['value'];

const aggregatorsFactory = (formatter) => ({
  Count: aggregatorTemplates.count(formatter),
  'Count Unique Values': aggregatorTemplates.countUnique(formatter),
  'List Unique Values': aggregatorTemplates.listUnique(', ', formatter),
  Sum: aggregatorTemplates.sum(formatter),
  Average: aggregatorTemplates.average(formatter),
  Median: aggregatorTemplates.median(formatter),
  'Sample Variance': aggregatorTemplates.var(1, formatter),
  'Sample Standard Deviation': aggregatorTemplates.stdev(1, formatter),
  Minimum: aggregatorTemplates.min(formatter),
  Maximum: aggregatorTemplates.max(formatter),
  First: aggregatorTemplates.first(formatter),
  Last: aggregatorTemplates.last(formatter),
  'Sum as Fraction of Total': aggregatorTemplates.fractionOf(
  aggregatorTemplates.sum(),
  'total',
  formatter),

  'Sum as Fraction of Rows': aggregatorTemplates.fractionOf(
  aggregatorTemplates.sum(),
  'row',
  formatter),

  'Sum as Fraction of Columns': aggregatorTemplates.fractionOf(
  aggregatorTemplates.sum(),
  'col',
  formatter),

  'Count as Fraction of Total': aggregatorTemplates.fractionOf(
  aggregatorTemplates.count(),
  'total',
  formatter),

  'Count as Fraction of Rows': aggregatorTemplates.fractionOf(
  aggregatorTemplates.count(),
  'row',
  formatter),

  'Count as Fraction of Columns': aggregatorTemplates.fractionOf(
  aggregatorTemplates.count(),
  'col',
  formatter) });



/* If you change this logic, please update the corresponding Python
 * function (https://github.com/apache/superset/blob/master/superset/charts/post_processing.py),
 * or reach out to @betodealmeida.
 */
export default function PivotTableChart(props) {
  const {
    data,
    height,
    width,
    groupbyRows: groupbyRowsRaw,
    groupbyColumns: groupbyColumnsRaw,
    metrics,
    colOrder,
    rowOrder,
    aggregateFunction,
    transposePivot,
    combineMetric,
    rowSubtotalPosition,
    colSubtotalPosition,
    colTotals,
    rowTotals,
    valueFormat,
    emitFilter,
    setDataMask,
    selectedFilters,
    verboseMap,
    columnFormats,
    metricsLayout,
    metricColorFormatters,
    dateFormatters } =
  props;

  const theme = useTheme();
  const defaultFormatter = useMemo(
  () => getNumberFormatter(valueFormat),
  [valueFormat]);

  const columnFormatsArray = useMemo(
  () => Object.entries(columnFormats),
  [columnFormats]);

  const hasCustomMetricFormatters = columnFormatsArray.length > 0;
  const metricFormatters = useMemo(
  () =>
  hasCustomMetricFormatters ?
  {
    [METRIC_KEY]: Object.fromEntries(
    columnFormatsArray.map(([metric, format]) => [
    metric,
    getNumberFormatter(format)])) } :



  undefined,
  [columnFormatsArray, hasCustomMetricFormatters]);


  const metricNames = useMemo(
  () =>
  metrics.map((metric) =>
  typeof metric === 'string' ? metric : metric.label),

  [metrics]);


  const unpivotedData = useMemo(
  () =>
  data.reduce(
  (acc, record) => [
  ...acc,
  ...metricNames.
  map((name) => ({
    ...record,
    [METRIC_KEY]: name,
    value: record[name] })).

  filter((record) => record.value !== null)],

  []),

  [data, metricNames]);

  const groupbyRows = useMemo(
  () => groupbyRowsRaw.map(getColumnLabel),
  [groupbyRowsRaw]);

  const groupbyColumns = useMemo(
  () => groupbyColumnsRaw.map(getColumnLabel),
  [groupbyColumnsRaw]);


  const sorters = useMemo(
  () => ({
    [METRIC_KEY]: sortAs(metricNames) }),

  [metricNames]);


  const [rows, cols] = useMemo(() => {
    let [rows_, cols_] = transposePivot ?
    [groupbyColumns, groupbyRows] :
    [groupbyRows, groupbyColumns];

    if (metricsLayout === MetricsLayoutEnum.ROWS) {
      rows_ = combineMetric ? [...rows_, METRIC_KEY] : [METRIC_KEY, ...rows_];
    } else {
      cols_ = combineMetric ? [...cols_, METRIC_KEY] : [METRIC_KEY, ...cols_];
    }
    return [rows_, cols_];
  }, [
  combineMetric,
  groupbyColumns,
  groupbyRows,
  metricsLayout,
  transposePivot]);


  const handleChange = useCallback(
  (filters) => {
    const filterKeys = Object.keys(filters);
    const groupby = [...groupbyRowsRaw, ...groupbyColumnsRaw];
    setDataMask({
      extraFormData: {
        filters:
        filterKeys.length === 0 ?
        undefined :
        filterKeys.map((key) => {var _groupby$find;
          const val = filters == null ? void 0 : filters[key];
          const col = (_groupby$find =
          groupby.find((item) => {
            if (isPhysicalColumn(item)) {
              return item === key;
            }
            if (isAdhocColumn(item)) {
              return item.label === key;
            }
            return false;
          })) != null ? _groupby$find : '';
          if (val === null || val === undefined)
          return {
            col,
            op: 'IS NULL' };

          return {
            col,
            op: 'IN',
            val: val };

        }) },

      filterState: {
        value:
        filters && Object.keys(filters).length ?
        Object.values(filters) :
        null,
        selectedFilters:
        filters && Object.keys(filters).length ? filters : null } });


  },
  [groupbyColumnsRaw, groupbyRowsRaw, setDataMask]);


  const toggleFilter = useCallback(
  (
  e,
  value,
  filters,
  pivotData,
  isSubtotal,
  isGrandTotal) =>
  {
    if (isSubtotal || isGrandTotal || !emitFilter) {
      return;
    }

    const isActiveFilterValue = (key, val) => {var _selectedFilters$key;return (
        !!selectedFilters && ((_selectedFilters$key = selectedFilters[key]) == null ? void 0 : _selectedFilters$key.includes(val)));};

    const filtersCopy = { ...filters };
    delete filtersCopy[METRIC_KEY];

    const filtersEntries = Object.entries(filtersCopy);
    if (filtersEntries.length === 0) {
      return;
    }

    const [key, val] = filtersEntries[filtersEntries.length - 1];

    let updatedFilters = { ...(selectedFilters || {}) };
    // multi select
    // if (selectedFilters && isActiveFilterValue(key, val)) {
    //   updatedFilters[key] = selectedFilters[key].filter((x: DataRecordValue) => x !== val);
    // } else {
    //   updatedFilters[key] = [...(selectedFilters?.[key] || []), val];
    // }
    // single select
    if (selectedFilters && isActiveFilterValue(key, val)) {
      updatedFilters = {};
    } else {
      updatedFilters = {
        [key]: [val] };

    }
    if (
    Array.isArray(updatedFilters[key]) &&
    updatedFilters[key].length === 0)
    {
      delete updatedFilters[key];
    }
    handleChange(updatedFilters);
  },
  [emitFilter, selectedFilters, handleChange]);


  const tableOptions = useMemo(
  () => ({
    clickRowHeaderCallback: toggleFilter,
    clickColumnHeaderCallback: toggleFilter,
    colTotals,
    rowTotals,
    highlightHeaderCellsOnHover: emitFilter,
    highlightedHeaderCells: selectedFilters,
    omittedHighlightHeaderGroups: [METRIC_KEY],
    cellColorFormatters: { [METRIC_KEY]: metricColorFormatters },
    dateFormatters }),

  [
  colTotals,
  dateFormatters,
  emitFilter,
  metricColorFormatters,
  rowTotals,
  selectedFilters,
  toggleFilter]);



  const subtotalOptions = useMemo(
  () => ({
    colSubtotalDisplay: { displayOnTop: colSubtotalPosition },
    rowSubtotalDisplay: { displayOnTop: rowSubtotalPosition },
    arrowCollapsed: ___EmotionJSX(PlusSquareOutlined, { style: iconStyle }),
    arrowExpanded: ___EmotionJSX(MinusSquareOutlined, { style: iconStyle }) }),

  [colSubtotalPosition, rowSubtotalPosition]);


  return (
    ___EmotionJSX(Styles, { height: height, width: width, margin: theme.gridUnit * 4 },
    ___EmotionJSX(PivotTableWrapper, null,
    ___EmotionJSX(PivotTable, {
      data: unpivotedData,
      rows: rows,
      cols: cols,
      aggregatorsFactory: aggregatorsFactory,
      defaultFormatter: defaultFormatter,
      customFormatters: metricFormatters,
      aggregatorName: aggregateFunction,
      vals: vals,
      colOrder: colOrder,
      rowOrder: rowOrder,
      sorters: sorters,
      tableOptions: tableOptions,
      subtotalOptions: subtotalOptions,
      namesMapping: verboseMap }))));




}__signature__(PivotTableChart, "useTheme{theme}\nuseMemo{defaultFormatter}\nuseMemo{columnFormatsArray}\nuseMemo{metricFormatters}\nuseMemo{metricNames}\nuseMemo{unpivotedData}\nuseMemo{groupbyRows}\nuseMemo{groupbyColumns}\nuseMemo{sorters}\nuseMemo{[rows, cols]}\nuseCallback{handleChange}\nuseCallback{toggleFilter}\nuseMemo{tableOptions}\nuseMemo{subtotalOptions}", () => [useTheme]);;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(Styles, "Styles", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-pivot-table/src/PivotTableChart.tsx");reactHotLoader.register(PivotTableWrapper, "PivotTableWrapper", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-pivot-table/src/PivotTableChart.tsx");reactHotLoader.register(METRIC_KEY, "METRIC_KEY", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-pivot-table/src/PivotTableChart.tsx");reactHotLoader.register(iconStyle, "iconStyle", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-pivot-table/src/PivotTableChart.tsx");reactHotLoader.register(vals, "vals", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-pivot-table/src/PivotTableChart.tsx");reactHotLoader.register(aggregatorsFactory, "aggregatorsFactory", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-pivot-table/src/PivotTableChart.tsx");reactHotLoader.register(PivotTableChart, "PivotTableChart", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-pivot-table/src/PivotTableChart.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();