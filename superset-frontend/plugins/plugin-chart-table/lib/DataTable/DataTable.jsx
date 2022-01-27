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
import React, { useCallback, useRef, } from 'react';
import { useTable, usePagination, useSortBy, useGlobalFilter, } from 'react-table';
import { matchSorter, rankings } from 'match-sorter';
import GlobalFilter from './components/GlobalFilter';
import SelectPageSize from './components/SelectPageSize';
import SimplePagination from './components/Pagination';
import useSticky from './hooks/useSticky';
import { PAGE_SIZE_OPTIONS } from '../consts';
import { sortAlphanumericCaseInsensitive } from './utils/sortAlphanumericCaseInsensitive';
const sortTypes = {
    alphanumeric: sortAlphanumericCaseInsensitive,
};
// Be sure to pass our updateMyData and the skipReset option
export default function DataTable({ tableClassName, columns, data, serverPaginationData, width: initialWidth = '100%', height: initialHeight = 300, pageSize: initialPageSize = 0, initialState: initialState_ = {}, pageSizeOptions = PAGE_SIZE_OPTIONS, maxPageItemCount = 9, sticky: doSticky, searchInput = true, onServerPaginationChange, rowCount, selectPageSize, noResults: noResultsText = 'No data found', hooks, serverPagination, wrapperRef: userWrapperRef, ...moreUseTableOptions }) {
    const tableHooks = [
        useGlobalFilter,
        useSortBy,
        usePagination,
        doSticky ? useSticky : [],
        hooks || [],
    ].flat();
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
        pageSize: initialPageSize > 0 ? initialPageSize : resultsSize || 10,
    };
    const defaultWrapperRef = useRef(null);
    const globalControlRef = useRef(null);
    const paginationRef = useRef(null);
    const wrapperRef = userWrapperRef || defaultWrapperRef;
    const paginationData = JSON.stringify(serverPaginationData);
    const defaultGetTableSize = useCallback(() => {
        if (wrapperRef.current) {
            // `initialWidth` and `initialHeight` could be also parameters like `100%`
            // `Number` reaturns `NaN` on them, then we fallback to computed size
            const width = Number(initialWidth) || wrapperRef.current.clientWidth;
            const height = (Number(initialHeight) || wrapperRef.current.clientHeight) -
                (globalControlRef.current?.clientHeight || 0) -
                (paginationRef.current?.clientHeight || 0);
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
        paginationData,
    ]);
    const defaultGlobalFilter = useCallback((rows, columnIds, filterValue) => {
        // allow searching by "col1_value col2_value"
        const joinedString = (row) => columnIds.map(x => row.values[x]).join(' ');
        return matchSorter(rows, filterValue, {
            keys: [...columnIds, joinedString],
            threshold: rankings.ACRONYM,
        });
    }, []);
    const { getTableProps, getTableBodyProps, prepareRow, headerGroups, footerGroups, page, pageCount, gotoPage, preGlobalFilteredRows, setGlobalFilter, setPageSize: setPageSize_, wrapStickyTable, state: { pageIndex, pageSize, globalFilter: filterValue, sticky = {} }, } = useTable({
        columns,
        data,
        initialState,
        getTableSize: defaultGetTableSize,
        globalFilter: defaultGlobalFilter,
        sortTypes,
        ...moreUseTableOptions,
    }, ...tableHooks);
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
    const noResults = typeof noResultsText === 'function'
        ? noResultsText(filterValue)
        : noResultsText;
    const getNoResults = () => <div className="dt-no-results">{noResults}</div>;
    if (!columns || columns.length === 0) {
        return (wrapStickyTable ? wrapStickyTable(getNoResults) : getNoResults());
    }
    const shouldRenderFooter = columns.some(x => !!x.Footer);
    const renderTable = () => (<table {...getTableProps({ className: tableClassName })}>
      <thead>
        {headerGroups.map(headerGroup => {
            const { key: headerGroupKey, ...headerGroupProps } = headerGroup.getHeaderGroupProps();
            return (<tr key={headerGroupKey || headerGroup.id} {...headerGroupProps}>
              {headerGroup.headers.map(column => column.render('Header', {
                    key: column.id,
                    ...column.getSortByToggleProps(),
                }))}
            </tr>);
        })}
      </thead>
      <tbody {...getTableBodyProps()}>
        {page && page.length > 0 ? (page.map(row => {
            prepareRow(row);
            const { key: rowKey, ...rowProps } = row.getRowProps();
            return (<tr key={rowKey || row.id} {...rowProps}>
                {row.cells.map(cell => cell.render('Cell', { key: cell.column.id }))}
              </tr>);
        })) : (<tr>
            <td className="dt-no-results" colSpan={columns.length}>
              {noResults}
            </td>
          </tr>)}
      </tbody>
      {shouldRenderFooter && (<tfoot>
          {footerGroups.map(footerGroup => {
                const { key: footerGroupKey, ...footerGroupProps } = footerGroup.getHeaderGroupProps();
                return (<tr key={footerGroupKey || footerGroup.id} {...footerGroupProps}>
                {footerGroup.headers.map(column => column.render('Footer', { key: column.id }))}
              </tr>);
            })}
        </tfoot>)}
    </table>);
    // force update the pageSize when it's been update from the initial state
    if (pageSizeRef.current[0] !== initialPageSize ||
        // when initialPageSize stays as zero, but total number of records changed,
        // we'd also need to update page size
        (initialPageSize === 0 && pageSizeRef.current[1] !== resultsSize)) {
        pageSizeRef.current = [initialPageSize, resultsSize];
        setPageSize(initialPageSize);
    }
    const paginationStyle = sticky.height
        ? {}
        : { visibility: 'hidden' };
    let resultPageCount = pageCount;
    let resultCurrentPageSize = pageSize;
    let resultCurrentPage = pageIndex;
    let resultOnPageChange = gotoPage;
    if (serverPagination) {
        const serverPageSize = serverPaginationData.pageSize ?? initialPageSize;
        resultPageCount = Math.ceil(rowCount / serverPageSize);
        if (!Number.isFinite(resultPageCount)) {
            resultPageCount = 0;
        }
        resultCurrentPageSize = serverPageSize;
        const foundPageSizeIndex = pageSizeOptions.findIndex(([option]) => option >= resultCurrentPageSize);
        if (foundPageSizeIndex === -1) {
            resultCurrentPageSize = 0;
        }
        resultCurrentPage = serverPaginationData.currentPage ?? 0;
        resultOnPageChange = (pageNumber) => onServerPaginationChange(pageNumber, serverPageSize);
    }
    return (<div ref={wrapperRef} style={{ width: initialWidth, height: initialHeight }}>
      {hasGlobalControl ? (<div ref={globalControlRef} className="form-inline dt-controls">
          <div className="row">
            <div className="col-sm-6">
              {hasPagination ? (<SelectPageSize total={resultsSize} current={resultCurrentPageSize} options={pageSizeOptions} selectRenderer={typeof selectPageSize === 'boolean'
                    ? undefined
                    : selectPageSize} onChange={setPageSize}/>) : null}
            </div>
            {searchInput ? (<div className="col-sm-6">
                <GlobalFilter searchInput={typeof searchInput === 'boolean' ? undefined : searchInput} preGlobalFilteredRows={preGlobalFilteredRows} setGlobalFilter={setGlobalFilter} filterValue={filterValue}/>
              </div>) : null}
          </div>
        </div>) : null}
      {wrapStickyTable ? wrapStickyTable(renderTable) : renderTable()}
      {hasPagination && resultPageCount > 1 ? (<SimplePagination ref={paginationRef} style={paginationStyle} maxPageItemCount={maxPageItemCount} pageCount={resultPageCount} currentPage={resultCurrentPage} onPageChange={resultOnPageChange}/>) : null}
    </div>);
}
//# sourceMappingURL=DataTable.jsx.map