import _extends from "@babel/runtime-corejs3/helpers/extends";import _pt from "prop-types";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /**
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
import React, {
useCallback,
useRef } from




'react';
import {
useTable,
usePagination,
useSortBy,
useGlobalFilter } from





'react-table';
import { matchSorter, rankings } from 'match-sorter';
import GlobalFilter from './components/GlobalFilter';
import SelectPageSize from


'./components/SelectPageSize';
import SimplePagination from './components/Pagination';
import useSticky from './hooks/useSticky';
import { PAGE_SIZE_OPTIONS } from '../consts';
import { sortAlphanumericCaseInsensitive } from './utils/sortAlphanumericCaseInsensitive';import { jsx as ___EmotionJSX } from "@emotion/react";
























const sortTypes = {
  alphanumeric: sortAlphanumericCaseInsensitive };


// Be sure to pass our updateMyData and the skipReset option
export default function DataTable({
  tableClassName,
  columns,
  data,
  serverPaginationData,
  width: initialWidth = '100%',
  height: initialHeight = 300,
  pageSize: initialPageSize = 0,
  initialState: initialState_ = {},
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  maxPageItemCount = 9,
  sticky: doSticky,
  searchInput = true,
  onServerPaginationChange,
  rowCount,
  selectPageSize,
  noResults: noResultsText = 'No data found',
  hooks,
  serverPagination,
  wrapperRef: userWrapperRef,
  ...moreUseTableOptions })
{
  const tableHooks = [
  useGlobalFilter,
  useSortBy,
  usePagination,
  doSticky ? useSticky : [],
  hooks || []].
  flat();
  const resultsSize = serverPagination ? rowCount : data.length;
  const sortByRef = useRef([]); // cache initial `sortby` so sorting doesn't trigger page reset
  const pageSizeRef = useRef([initialPageSize, resultsSize]);
  const hasPagination = initialPageSize > 0 && resultsSize > 0; // pageSize == 0 means no pagination
  const hasGlobalControl = hasPagination || !!searchInput;
  const initialState = {
    ...initialState_,
    // zero length means all pages, the `usePagination` plugin does not
    // understand pageSize = 0
    sortBy: sortByRef.current,
    pageSize: initialPageSize > 0 ? initialPageSize : resultsSize || 10 };

  const defaultWrapperRef = useRef(null);
  const globalControlRef = useRef(null);
  const paginationRef = useRef(null);
  const wrapperRef = userWrapperRef || defaultWrapperRef;
  const paginationData = JSON.stringify(serverPaginationData);

  const defaultGetTableSize = useCallback(() => {
    if (wrapperRef.current) {var _globalControlRef$cur, _paginationRef$curren;
      // `initialWidth` and `initialHeight` could be also parameters like `100%`
      // `Number` reaturns `NaN` on them, then we fallback to computed size
      const width = Number(initialWidth) || wrapperRef.current.clientWidth;
      const height =
      (Number(initialHeight) || wrapperRef.current.clientHeight) - (
      ((_globalControlRef$cur = globalControlRef.current) == null ? void 0 : _globalControlRef$cur.clientHeight) || 0) - (
      ((_paginationRef$curren = paginationRef.current) == null ? void 0 : _paginationRef$curren.clientHeight) || 0);
      return { width, height };
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
  initialHeight,
  initialWidth,
  wrapperRef,
  hasPagination,
  hasGlobalControl,
  paginationRef,
  resultsSize,
  paginationData]);


  const defaultGlobalFilter = useCallback(
  (rows, columnIds, filterValue) => {
    // allow searching by "col1_value col2_value"
    const joinedString = (row) =>
    columnIds.map((x) => row.values[x]).join(' ');
    return matchSorter(rows, filterValue, {
      keys: [...columnIds, joinedString],
      threshold: rankings.ACRONYM });

  },
  []);


  const {
    getTableProps,
    getTableBodyProps,
    prepareRow,
    headerGroups,
    footerGroups,
    page,
    pageCount,
    gotoPage,
    preGlobalFilteredRows,
    setGlobalFilter,
    setPageSize: setPageSize_,
    wrapStickyTable,
    state: { pageIndex, pageSize, globalFilter: filterValue, sticky = {} } } =
  useTable(
  {
    columns,
    data,
    initialState,
    getTableSize: defaultGetTableSize,
    globalFilter: defaultGlobalFilter,
    sortTypes,
    ...moreUseTableOptions },

  ...tableHooks);

  // make setPageSize accept 0
  const setPageSize = (size) => {
    if (serverPagination) {
      onServerPaginationChange(0, size);
    }
    // keep the original size if data is empty
    if (size || resultsSize !== 0) {
      setPageSize_(size === 0 ? resultsSize : size);
    }
  };

  const noResults =
  typeof noResultsText === 'function' ?
  noResultsText(filterValue) :
  noResultsText;

  const getNoResults = () => ___EmotionJSX("div", { className: "dt-no-results" }, noResults);

  if (!columns || columns.length === 0) {
    return (
      wrapStickyTable ? wrapStickyTable(getNoResults) : getNoResults());

  }

  const shouldRenderFooter = columns.some((x) => !!x.Footer);

  const renderTable = () =>
  ___EmotionJSX("table", getTableProps({ className: tableClassName }),
  ___EmotionJSX("thead", null,
  headerGroups.map((headerGroup) => {
    const { key: headerGroupKey, ...headerGroupProps } =
    headerGroup.getHeaderGroupProps();
    return (
      ___EmotionJSX("tr", _extends({ key: headerGroupKey || headerGroup.id }, headerGroupProps),
      headerGroup.headers.map((column) =>
      column.render('Header', {
        key: column.id,
        ...column.getSortByToggleProps() }))));




  })),

  ___EmotionJSX("tbody", getTableBodyProps(),
  page && page.length > 0 ?
  page.map((row) => {
    prepareRow(row);
    const { key: rowKey, ...rowProps } = row.getRowProps();
    return (
      ___EmotionJSX("tr", _extends({ key: rowKey || row.id }, rowProps),
      row.cells.map((cell) =>
      cell.render('Cell', { key: cell.column.id }))));



  }) :

  ___EmotionJSX("tr", null,
  ___EmotionJSX("td", { className: "dt-no-results", colSpan: columns.length },
  noResults))),




  shouldRenderFooter &&
  ___EmotionJSX("tfoot", null,
  footerGroups.map((footerGroup) => {
    const { key: footerGroupKey, ...footerGroupProps } =
    footerGroup.getHeaderGroupProps();
    return (
      ___EmotionJSX("tr", _extends({ key: footerGroupKey || footerGroup.id }, footerGroupProps),
      footerGroup.headers.map((column) =>
      column.render('Footer', { key: column.id }))));



  })));





  // force update the pageSize when it's been update from the initial state
  if (
  pageSizeRef.current[0] !== initialPageSize ||


  initialPageSize === 0 && pageSizeRef.current[1] !== resultsSize)
  {
    pageSizeRef.current = [initialPageSize, resultsSize];
    setPageSize(initialPageSize);
  }

  const paginationStyle = sticky.height ?
  {} :
  { visibility: 'hidden' };

  let resultPageCount = pageCount;
  let resultCurrentPageSize = pageSize;
  let resultCurrentPage = pageIndex;
  let resultOnPageChange = gotoPage;
  if (serverPagination) {var _serverPaginationData, _serverPaginationData2;
    const serverPageSize = (_serverPaginationData = serverPaginationData.pageSize) != null ? _serverPaginationData : initialPageSize;
    resultPageCount = Math.ceil(rowCount / serverPageSize);
    if (!Number.isFinite(resultPageCount)) {
      resultPageCount = 0;
    }
    resultCurrentPageSize = serverPageSize;
    const foundPageSizeIndex = pageSizeOptions.findIndex(
    ([option]) => option >= resultCurrentPageSize);

    if (foundPageSizeIndex === -1) {
      resultCurrentPageSize = 0;
    }
    resultCurrentPage = (_serverPaginationData2 = serverPaginationData.currentPage) != null ? _serverPaginationData2 : 0;
    resultOnPageChange = (pageNumber) =>
    onServerPaginationChange(pageNumber, serverPageSize);
  }
  return (
    ___EmotionJSX("div", {
      ref: wrapperRef,
      style: { width: initialWidth, height: initialHeight } },

    hasGlobalControl ?
    ___EmotionJSX("div", { ref: globalControlRef, className: "form-inline dt-controls" },
    ___EmotionJSX("div", { className: "row" },
    ___EmotionJSX("div", { className: "col-sm-6" },
    hasPagination ?
    ___EmotionJSX(SelectPageSize, {
      total: resultsSize,
      current: resultCurrentPageSize,
      options: pageSizeOptions,
      selectRenderer:
      typeof selectPageSize === 'boolean' ?
      undefined :
      selectPageSize,

      onChange: setPageSize }) :

    null),

    searchInput ?
    ___EmotionJSX("div", { className: "col-sm-6" },
    ___EmotionJSX(GlobalFilter, {
      searchInput:
      typeof searchInput === 'boolean' ? undefined : searchInput,

      preGlobalFilteredRows: preGlobalFilteredRows,
      setGlobalFilter: setGlobalFilter,
      filterValue: filterValue })) :


    null)) :


    null,
    wrapStickyTable ? wrapStickyTable(renderTable) : renderTable(),
    hasPagination && resultPageCount > 1 ?
    ___EmotionJSX(SimplePagination, {
      ref: paginationRef,
      style: paginationStyle,
      maxPageItemCount: maxPageItemCount,
      pageCount: resultPageCount,
      currentPage: resultCurrentPage,
      onPageChange: resultOnPageChange }) :

    null));


}__signature__(DataTable, "useRef{sortByRef}\nuseRef{pageSizeRef}\nuseRef{defaultWrapperRef}\nuseRef{globalControlRef}\nuseRef{paginationRef}\nuseCallback{defaultGetTableSize}\nuseCallback{defaultGlobalFilter: FilterType<D>}\nuseTable{{\n    getTableProps,\n    getTableBodyProps,\n    prepareRow,\n    headerGroups,\n    footerGroups,\n    page,\n    pageCount,\n    gotoPage,\n    preGlobalFilteredRows,\n    setGlobalFilter,\n    setPageSize: setPageSize_,\n    wrapStickyTable,\n    state: { pageIndex, pageSize, globalFilter: filterValue, sticky = {} },\n  }}", () => [useTable]);DataTable.propTypes = { tableClassName: _pt.string, pageSizeOptions: _pt.array, maxPageItemCount: _pt.number, hooks: _pt.array, width: _pt.oneOfType([_pt.string, _pt.number]), height: _pt.oneOfType([_pt.string, _pt.number]), serverPagination: _pt.bool, onServerPaginationChange: _pt.func.isRequired, serverPaginationData: _pt.shape({ pageSize: _pt.number, currentPage: _pt.number }).isRequired, pageSize: _pt.number, noResults: _pt.oneOfType([_pt.string, _pt.func]), sticky: _pt.bool, rowCount: _pt.number.isRequired };;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(sortTypes, "sortTypes", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/DataTable/DataTable.tsx");reactHotLoader.register(DataTable, "DataTable", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/DataTable/DataTable.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();