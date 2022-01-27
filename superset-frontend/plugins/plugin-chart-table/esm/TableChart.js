import _extends from "@babel/runtime-corejs3/helpers/extends";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /**
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





import { extent as d3Extent, max as d3Max } from 'd3-array';
import { FaSort } from '@react-icons/all-files/fa/FaSort';
import { FaSortDown as FaSortDesc } from '@react-icons/all-files/fa/FaSortDown';
import { FaSortUp as FaSortAsc } from '@react-icons/all-files/fa/FaSortUp';
import {


DTTM_ALIAS,
ensureIsArray,
GenericDataType,
getTimeFormatterForGranularity,
t,
tn } from
'@superset-ui/core';


import DataTable from




'./DataTable';

import Styles from './Styles';
import { formatColumnValue } from './utils/formatValue';
import { PAGE_SIZE_OPTIONS } from './consts';
import { updateExternalFormData } from './DataTable/utils/externalAPIs';import { jsx as ___EmotionJSX } from "@emotion/react";



/**
 * Return sortType based on data type
 */
function getSortTypeByDataType(dataType) {
  if (dataType === GenericDataType.TEMPORAL) {
    return 'datetime';
  }
  if (dataType === GenericDataType.STRING) {
    return 'alphanumeric';
  }
  return 'basic';
}

/**
 * Cell background to render columns as horizontal bar chart
 */
function cellBar({
  value,
  valueRange,
  colorPositiveNegative = false,
  alignPositiveNegative })





{
  const [minValue, maxValue] = valueRange;
  const r = colorPositiveNegative && value < 0 ? 150 : 0;
  if (alignPositiveNegative) {
    const perc = Math.abs(Math.round(value / maxValue * 100));
    // The 0.01 to 0.001 is a workaround for what appears to be a
    // CSS rendering bug on flat, transparent colors
    return (
      `linear-gradient(to right, rgba(${r},0,0,0.2), rgba(${r},0,0,0.2) ${perc}%, ` +
      `rgba(0,0,0,0.01) ${perc}%, rgba(0,0,0,0.001) 100%)`);

  }
  const posExtent = Math.abs(Math.max(maxValue, 0));
  const negExtent = Math.abs(Math.min(minValue, 0));
  const tot = posExtent + negExtent;
  const perc1 = Math.round(
  Math.min(negExtent + value, negExtent) / tot * 100);

  const perc2 = Math.round(Math.abs(value) / tot * 100);
  // The 0.01 to 0.001 is a workaround for what appears to be a
  // CSS rendering bug on flat, transparent colors
  return (
    `linear-gradient(to right, rgba(0,0,0,0.01), rgba(0,0,0,0.001) ${perc1}%, ` +
    `rgba(${r},0,0,0.2) ${perc1}%, rgba(${r},0,0,0.2) ${perc1 + perc2}%, ` +
    `rgba(0,0,0,0.01) ${perc1 + perc2}%, rgba(0,0,0,0.001) 100%)`);

}

function SortIcon({ column }) {
  const { isSorted, isSortedDesc } = column;
  let sortIcon = ___EmotionJSX(FaSort, null);
  if (isSorted) {
    sortIcon = isSortedDesc ? ___EmotionJSX(FaSortDesc, null) : ___EmotionJSX(FaSortAsc, null);
  }
  return sortIcon;
}

function SearchInput({ count, value, onChange }) {
  return (
    ___EmotionJSX("span", { className: "dt-global-filter" },
    t('Search'), ' ',
    ___EmotionJSX("input", {
      className: "form-control input-sm",
      placeholder: tn('search.num_records', count),
      value: value,
      onChange: onChange })));



}

function SelectPageSize({
  options,
  current,
  onChange })
{
  return (
    ___EmotionJSX("span", { className: "dt-select-page-size form-inline" },
    t('page_size.show'), ' ',
    ___EmotionJSX("select", {
      className: "form-control input-sm",
      value: current,
      onBlur: () => {},
      onChange: (e) => {
        onChange(Number(e.target.value));
      } },

    options.map((option) => {
      const [size, text] = Array.isArray(option) ?
      option :
      [option, option];
      return (
        ___EmotionJSX("option", { key: size, value: size },
        text));


    })),
    ' ',
    t('page_size.entries')));


}

export default function TableChart(
props)


{
  const {
    timeGrain,
    height,
    width,
    data,
    totals,
    isRawRecords,
    rowCount = 0,
    columns: columnsMeta,
    alignPositiveNegative: defaultAlignPN = false,
    colorPositiveNegative: defaultColorPN = false,
    includeSearch = false,
    pageSize = 0,
    serverPagination = false,
    serverPaginationData,
    setDataMask,
    showCellBars = true,
    emitFilter = false,
    sortDesc = false,
    filters,
    sticky = true, // whether to use sticky header
    columnColorFormatters } =
  props;
  const timestampFormatter = useCallback(
  (value) => getTimeFormatterForGranularity(timeGrain)(value),
  [timeGrain]);


  const handleChange = useCallback(
  (filters) => {
    if (!emitFilter) {
      return;
    }

    const groupBy = Object.keys(filters);
    const groupByValues = Object.values(filters);
    const labelElements = [];
    groupBy.forEach((col) => {
      const isTimestamp = col === DTTM_ALIAS;
      const filterValues = ensureIsArray(filters == null ? void 0 : filters[col]);
      if (filterValues.length) {
        const valueLabels = filterValues.map((value) =>
        isTimestamp ? timestampFormatter(value) : value);

        labelElements.push(`${valueLabels.join(', ')}`);
      }
    });
    setDataMask({
      extraFormData: {
        filters:
        groupBy.length === 0 ?
        [] :
        groupBy.map((col) => {
          const val = ensureIsArray(filters == null ? void 0 : filters[col]);
          if (!val.length)
          return {
            col,
            op: 'IS NULL' };

          return {
            col,
            op: 'IN',
            val: val.map((el) =>
            el instanceof Date ? el.getTime() : el),

            grain: col === DTTM_ALIAS ? timeGrain : undefined };

        }) },

      filterState: {
        label: labelElements.join(', '),
        value: groupByValues.length ? groupByValues : null,
        filters: filters && Object.keys(filters).length ? filters : null } });


  },
  [emitFilter, setDataMask]);


  // only take relevant page size options
  const pageSizeOptions = useMemo(() => {
    const getServerPagination = (n) => n <= rowCount;
    return PAGE_SIZE_OPTIONS.filter(([n]) =>
    serverPagination ? getServerPagination(n) : n <= 2 * data.length);

  }, [data.length, rowCount, serverPagination]);

  const getValueRange = useCallback(
  function getValueRange(key, alignPositiveNegative) {var _data$;
    if (typeof (data == null ? void 0 : (_data$ = data[0]) == null ? void 0 : _data$[key]) === 'number') {
      const nums = data.map((row) => row[key]);
      return (
        alignPositiveNegative ?
        [0, d3Max(nums.map(Math.abs))] :
        d3Extent(nums));

    }
    return null;
  },
  [data]);


  const isActiveFilterValue = useCallback(
  function isActiveFilterValue(key, val) {var _filters$key;
    return !!filters && ((_filters$key = filters[key]) == null ? void 0 : _filters$key.includes(val));
  },
  [filters]);


  function getEmitTarget(col) {var _meta$config;
    const meta = columnsMeta == null ? void 0 : columnsMeta.find((x) => x.key === col);
    return (meta == null ? void 0 : (_meta$config = meta.config) == null ? void 0 : _meta$config.emitTarget) || col;
  }

  const toggleFilter = useCallback(
  function toggleFilter(key, val) {
    let updatedFilters = { ...(filters || {}) };
    const target = getEmitTarget(key);
    if (filters && isActiveFilterValue(target, val)) {
      updatedFilters = {};
    } else {
      updatedFilters = {
        [target]: [val] };

    }
    if (
    Array.isArray(updatedFilters[target]) &&
    updatedFilters[target].length === 0)
    {
      delete updatedFilters[target];
    }
    handleChange(updatedFilters);
  },
  [filters, handleChange, isActiveFilterValue]);


  const getSharedStyle = (column) => {
    const { isNumeric, config = {} } = column;
    const textAlign = config.horizontalAlign ?
    config.horizontalAlign :
    isNumeric ?
    'right' :
    'left';
    return {
      textAlign };

  };

  const getColumnConfigs = useCallback(
  (column, i) => {
    const { key, label, isNumeric, dataType, isMetric, config = {} } = column;
    const isFilter = !isNumeric && emitFilter;
    const columnWidth = Number.isNaN(Number(config.columnWidth)) ?
    config.columnWidth :
    Number(config.columnWidth);

    // inline style for both th and td cell
    const sharedStyle = getSharedStyle(column);

    const alignPositiveNegative =
    config.alignPositiveNegative === undefined ?
    defaultAlignPN :
    config.alignPositiveNegative;
    const colorPositiveNegative =
    config.colorPositiveNegative === undefined ?
    defaultColorPN :
    config.colorPositiveNegative;

    const hasColumnColorFormatters =
    isNumeric &&
    Array.isArray(columnColorFormatters) &&
    columnColorFormatters.length > 0;

    const valueRange =
    !hasColumnColorFormatters && (
    config.showCellBars === undefined ?
    showCellBars :
    config.showCellBars) && (
    isMetric || isRawRecords) &&
    getValueRange(key, alignPositiveNegative);

    let className = '';
    if (isFilter) {
      className += ' dt-is-filter';
    }

    return {
      id: String(i), // to allow duplicate column keys
      // must use custom accessor to allow `.` in column names
      // typing is incorrect in current version of `@types/react-table`
      // so we ask TS not to check.
      accessor: (datum) => datum[key],
      Cell: ({ value }) => {
        const [isHtml, text] = formatColumnValue(column, value);
        const html = isHtml ? { __html: text } : undefined;

        let backgroundColor;
        if (hasColumnColorFormatters) {
          columnColorFormatters.
          filter((formatter) => formatter.column === column.key).
          forEach((formatter) => {
            const formatterResult = formatter.getColorFromValue(
            value);

            if (formatterResult) {
              backgroundColor = formatterResult;
            }
          });
        }

        const cellProps = {
          // show raw number in title in case of numeric values
          title: typeof value === 'number' ? String(value) : undefined,
          onClick:
          emitFilter && !valueRange ?
          () => toggleFilter(key, value) :
          undefined,
          className: [
          className,
          value == null ? 'dt-is-null' : '',
          isActiveFilterValue(key, value) ? ' dt-is-active-filter' : ''].
          join(' '),
          style: {
            ...sharedStyle,
            background:
            backgroundColor || (
            valueRange ?
            cellBar({
              value: value,
              valueRange,
              alignPositiveNegative,
              colorPositiveNegative }) :

            undefined) } };


        if (html) {
          // eslint-disable-next-line react/no-danger
          return ___EmotionJSX("td", _extends({}, cellProps, { dangerouslySetInnerHTML: html }));
        }
        // If cellProps renderes textContent already, then we don't have to
        // render `Cell`. This saves some time for large tables.
        return ___EmotionJSX("td", cellProps, text);
      },
      Header: ({ column: col, onClick, style }) =>
      ___EmotionJSX("th", {
        title: "Shift + Click to sort by multiple columns",
        className: [className, col.isSorted ? 'is-sorted' : ''].join(' '),
        style: {
          ...sharedStyle,
          ...style },

        onClick: onClick },


      config.columnWidth ?
      // column width hint
      ___EmotionJSX("div", {
        style: {
          width: columnWidth,
          height: 0.01 } }) :


      null,
      label,
      ___EmotionJSX(SortIcon, { column: col })),


      Footer: totals ?
      i === 0 ?
      ___EmotionJSX("th", null, t('Totals')) :

      ___EmotionJSX("td", { style: sharedStyle },
      ___EmotionJSX("strong", null, formatColumnValue(column, totals[key])[1])) :


      undefined,
      sortDescFirst: sortDesc,
      sortType: getSortTypeByDataType(dataType) };

  },
  [
  defaultAlignPN,
  defaultColorPN,
  emitFilter,
  getValueRange,
  isActiveFilterValue,
  isRawRecords,
  showCellBars,
  sortDesc,
  toggleFilter,
  totals,
  columnColorFormatters]);



  const columns = useMemo(
  () => columnsMeta.map(getColumnConfigs),
  [columnsMeta, getColumnConfigs]);


  const handleServerPaginationChange = (
  pageNumber,
  pageSize) =>
  {
    updateExternalFormData(setDataMask, pageNumber, pageSize);
  };

  return (
    ___EmotionJSX(Styles, null,
    ___EmotionJSX(DataTable, {
      columns: columns,
      data: data,
      rowCount: rowCount,
      tableClassName: "table table-striped table-condensed",
      pageSize: pageSize,
      serverPaginationData: serverPaginationData,
      pageSizeOptions: pageSizeOptions,
      width: width,
      height: height,
      serverPagination: serverPagination,
      onServerPaginationChange: handleServerPaginationChange
      // 9 page items in > 340px works well even for 100+ pages
      , maxPageItemCount: width > 340 ? 9 : 7,
      noResults: (filter) =>
      t(filter ? 'No matching records found' : 'No records found'),

      searchInput: includeSearch && SearchInput,
      selectPageSize: pageSize !== null && SelectPageSize
      // not in use in Superset, but needed for unit tests
      , sticky: sticky })));



}__signature__(TableChart, "useCallback{timestampFormatter}\nuseCallback{handleChange}\nuseMemo{pageSizeOptions}\nuseCallback{getValueRange}\nuseCallback{isActiveFilterValue}\nuseCallback{toggleFilter}\nuseCallback{getColumnConfigs}\nuseMemo{columns}");;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(getSortTypeByDataType, "getSortTypeByDataType", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/TableChart.tsx");reactHotLoader.register(cellBar, "cellBar", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/TableChart.tsx");reactHotLoader.register(SortIcon, "SortIcon", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/TableChart.tsx");reactHotLoader.register(SearchInput, "SearchInput", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/TableChart.tsx");reactHotLoader.register(SelectPageSize, "SelectPageSize", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/TableChart.tsx");reactHotLoader.register(TableChart, "TableChart", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/TableChart.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();