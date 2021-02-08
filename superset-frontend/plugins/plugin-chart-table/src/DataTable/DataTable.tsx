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
import React, { useCallback, useRef, ReactNode, HTMLProps, MutableRefObject } from 'react';
import {
  useTable,
  usePagination,
  useSortBy,
  useGlobalFilter,
  PluginHook,
  TableOptions,
  FilterType,
  IdType,
  Row,
} from 'react-table';
import { matchSorter, rankings } from 'match-sorter';
import GlobalFilter, { GlobalFilterProps } from './components/GlobalFilter';
import SelectPageSize, { SelectPageSizeProps, SizeOption } from './components/SelectPageSize';
import SimplePagination from './components/Pagination';
import useSticky from './hooks/useSticky';

export interface DataTableProps<D extends object> extends TableOptions<D> {
  tableClassName?: string;
  searchInput?: boolean | GlobalFilterProps<D>['searchInput'];
  selectPageSize?: boolean | SelectPageSizeProps['selectRenderer'];
  pageSizeOptions?: SizeOption[]; // available page size options
  maxPageItemCount?: number;
  hooks?: PluginHook<D>[]; // any additional hooks
  width?: string | number;
  height?: string | number;
  pageSize?: number;
  noResults?: string | ((filterString: string) => ReactNode);
  sticky?: boolean;
  wrapperRef?: MutableRefObject<HTMLDivElement>;
}

export interface RenderHTMLCellProps extends HTMLProps<HTMLTableCellElement> {
  cellContent: ReactNode;
}

// Be sure to pass our updateMyData and the skipReset option
export default function DataTable<D extends object>({
  tableClassName,
  columns,
  data,
  width: initialWidth = '100%',
  height: initialHeight = 300,
  pageSize: initialPageSize = 0,
  initialState: initialState_ = {},
  pageSizeOptions = [10, 25, 50, 100, 200],
  maxPageItemCount = 9,
  sticky: doSticky,
  searchInput = true,
  selectPageSize,
  noResults: noResultsText = 'No data found',
  hooks,
  wrapperRef: userWrapperRef,
  ...moreUseTableOptions
}: DataTableProps<D>): JSX.Element {
  const tableHooks: PluginHook<D>[] = [
    useGlobalFilter,
    useSortBy,
    usePagination,
    doSticky ? useSticky : [],
    hooks || [],
  ].flat();
  const sortByRef = useRef([]); // cache initial `sortby` so sorting doesn't trigger page reset
  const pageSizeRef = useRef([initialPageSize, data.length]);
  const hasPagination = initialPageSize > 0 && data.length > 0; // pageSize == 0 means no pagination
  const hasGlobalControl = hasPagination || !!searchInput;
  const initialState = {
    ...initialState_,
    // zero length means all pages, the `usePagination` plugin does not
    // understand pageSize = 0
    sortBy: sortByRef.current,
    pageSize: initialPageSize > 0 ? initialPageSize : data.length || 10,
  };

  const defaultWrapperRef = useRef<HTMLDivElement>(null);
  const globalControlRef = useRef<HTMLDivElement>(null);
  const paginationRef = useRef<HTMLDivElement>(null);
  const wrapperRef = userWrapperRef || defaultWrapperRef;

  const defaultGetTableSize = useCallback(() => {
    if (wrapperRef.current) {
      // `initialWidth` and `initialHeight` could be also parameters like `100%`
      // `Number` reaturns `NaN` on them, then we fallback to computed size
      const width = Number(initialWidth) || wrapperRef.current.clientWidth;
      const height =
        (Number(initialHeight) || wrapperRef.current.clientHeight) -
        (globalControlRef.current?.clientHeight || 0) -
        (paginationRef.current?.clientHeight || 0);
      return { width, height };
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHeight, initialWidth, wrapperRef, hasPagination, hasGlobalControl]);

  const defaultGlobalFilter: FilterType<D> = useCallback(
    (rows: Row<D>[], columnIds: IdType<D>[], filterValue: string) => {
      // allow searching by "col1_value col2_value"
      const joinedString = (row: Row<D>) => columnIds.map(x => row.values[x]).join(' ');
      return matchSorter(rows, filterValue, {
        keys: [...columnIds, joinedString],
        threshold: rankings.ACRONYM,
      }) as typeof rows;
    },
    [],
  );

  const {
    getTableProps,
    getTableBodyProps,
    prepareRow,
    headerGroups,
    page,
    pageCount,
    gotoPage,
    preGlobalFilteredRows,
    setGlobalFilter,
    setPageSize: setPageSize_,
    wrapStickyTable,
    state: { pageIndex, pageSize, globalFilter: filterValue, sticky = {} },
  } = useTable<D>(
    {
      columns,
      data,
      initialState,
      getTableSize: defaultGetTableSize,
      globalFilter: defaultGlobalFilter,
      ...moreUseTableOptions,
    },
    ...tableHooks,
  );
  // make setPageSize accept 0
  const setPageSize = (size: number) => {
    // keep the original size if data is empty
    if (size || data.length !== 0) {
      setPageSize_(size === 0 ? data.length : size);
    }
  };

  const noResults =
    typeof noResultsText === 'function' ? noResultsText(filterValue as string) : noResultsText;

  if (!columns || columns.length === 0) {
    return <div className="dt-no-results">{noResults}</div>;
  }

  const renderTable = () => (
    <table {...getTableProps({ className: tableClassName })}>
      <thead>
        {headerGroups.map(headerGroup => {
          const { key: headerGroupKey, ...headerGroupProps } = headerGroup.getHeaderGroupProps();
          return (
            <tr key={headerGroupKey || headerGroup.id} {...headerGroupProps}>
              {headerGroup.headers.map(column =>
                column.render('Header', {
                  key: column.id,
                  ...column.getSortByToggleProps(),
                }),
              )}
            </tr>
          );
        })}
      </thead>
      <tbody {...getTableBodyProps()}>
        {page && page.length > 0 ? (
          page.map(row => {
            prepareRow(row);
            const { key: rowKey, ...rowProps } = row.getRowProps();
            return (
              <tr key={rowKey || row.id} {...rowProps}>
                {row.cells.map(cell => cell.render('Cell', { key: cell.column.id }))}
              </tr>
            );
          })
        ) : (
          <tr>
            <td className="dt-no-results" colSpan={columns.length}>
              {noResults}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  // force upate the pageSize when it's been update from the initial state
  if (
    pageSizeRef.current[0] !== initialPageSize ||
    // when initialPageSize stays as zero, but total number of records changed,
    // we'd also need to update page size
    (initialPageSize === 0 && pageSizeRef.current[1] !== data.length)
  ) {
    pageSizeRef.current = [initialPageSize, data.length];
    setPageSize(initialPageSize);
  }

  return (
    <div ref={wrapperRef} style={{ width: initialWidth, height: initialHeight }}>
      {hasGlobalControl ? (
        <div ref={globalControlRef} className="form-inline dt-controls">
          <div className="row">
            <div className="col-sm-6">
              {hasPagination ? (
                <SelectPageSize
                  total={data.length}
                  current={pageSize}
                  options={pageSizeOptions}
                  selectRenderer={typeof selectPageSize === 'boolean' ? undefined : selectPageSize}
                  onChange={setPageSize}
                />
              ) : null}
            </div>
            {searchInput ? (
              <div className="col-sm-6">
                <GlobalFilter<D>
                  searchInput={typeof searchInput === 'boolean' ? undefined : searchInput}
                  preGlobalFilteredRows={preGlobalFilteredRows}
                  setGlobalFilter={setGlobalFilter}
                  filterValue={filterValue}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {wrapStickyTable ? wrapStickyTable(renderTable) : renderTable()}
      {hasPagination ? (
        <SimplePagination
          ref={paginationRef}
          style={sticky.height ? undefined : { visibility: 'hidden' }}
          maxPageItemCount={maxPageItemCount}
          pageCount={pageCount}
          currentPage={pageIndex}
          onPageChange={gotoPage}
        />
      ) : null}
    </div>
  );
}
